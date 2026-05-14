// ============================================================================
// High-Performance Player Manager with Memory Optimization
// Guild-specific playback sessions with efficient state management
// ============================================================================

import type {
  PlayerOptions,
  PlayOptions,
  VoiceUpdateOptions,
  Filters,
  EqualizerBand,
  Track,
  NodeStats,
} from '../types';
import { DavelinkError, ErrorCode } from '../errors';
import { TypedEventEmitter } from '../core/EventEmitter';
import type { Node } from '../node/Node';

// ============================================================================
// Voice State Manager
// ============================================================================

interface VoiceState {
  channelId: string | null;
  sessionId: string | null;
  token: string | null;
  endpoint: string | null;
}

// Object pool for voice states
class VoiceStatePool {
  private pool: VoiceState[] = [];
  private readonly maxPoolSize = 100;

  acquire(): VoiceState {
    return this.pool.pop() ?? {
      channelId: null,
      sessionId: null,
      token: null,
      endpoint: null,
    };
  }

  release(state: VoiceState): void {
    if (this.pool.length < this.maxPoolSize) {
      state.channelId = null;
      state.sessionId = null;
      state.token = null;
      state.endpoint = null;
      this.pool.push(state);
    }
  }
}

const voiceStatePool = new VoiceStatePool();

// ============================================================================
// Player State
// ============================================================================

interface PlayerInternalState {
  guildId: string;
  channelId: string | null;
  currentTrack: Track | null;
  previousTrack: Track | null;
  queue: Track[];
  position: number;
  paused: boolean;
  volume: number;
  voice: VoiceState;
  filters: Filters;
  lastUpdate: number;
  autoPlay: boolean;
}

const PLAYER_DEFAULTS: Omit<PlayerInternalState, 'guildId' | 'voice'> = {
  channelId: null,
  currentTrack: null,
  previousTrack: null,
  queue: [],
  position: 0,
  paused: false,
  volume: 100,
  filters: {},
  lastUpdate: Date.now(),
  autoPlay: true,
};

// ============================================================================
// Player Class
// ============================================================================

export class Player extends TypedEventEmitter {
  readonly guildId: string;
  readonly node: Node;

  private state: PlayerInternalState;
  private voiceState: VoiceState;
  private destroyed = false;

  constructor(guildId: string, node: Node, options: PlayerOptions = { guildId }) {
    super(100);

    this.guildId = guildId;
    this.node = node;
    this.voiceState = voiceStatePool.acquire();

    // Initialize state
    this.state = {
      guildId,
      ...PLAYER_DEFAULTS,
      voice: this.voiceState,
    };

    // Apply options
    if (options.channelId) {
      this.state.channelId = options.channelId;
    }

    // Forward node events to player events
    this._setupEventForwarding();
  }

  // ============================================================================
  // Playback Controls
  // ============================================================================

  /**
   * Play a track or the next in queue
   */
  async play(options: PlayOptions = {}): Promise<void> {
    if (this.destroyed) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
    }

    let track: Track | string | undefined = options.track;

    // Get from queue if no track provided
    if (!track && this.state.queue.length > 0) {
      track = this.state.queue.shift()!;
      this.state.previousTrack = this.state.currentTrack;
    }

    if (!track) {
      // No track available
      this.emit('queueEnd', this as unknown as Player);
      return;
    }

    // Resolve track to encoded string
    const encodedTrack = typeof track === 'string' ? track : track.encoded;

    // Build player update payload
    const payload: Record<string, unknown> = {
      encodedTrack,
      volume: options.volume ?? this.state.volume,
    };

    if (options.startTime !== undefined) {
      payload.position = options.startTime;
    }

    if (options.endTime !== undefined) {
      payload.endTime = options.endTime;
    }

    if (options.pauseAfter !== undefined) {
      payload.paused = options.pauseAfter;
    }

    if (options.noReplace !== undefined) {
      payload.noReplace = options.noReplace;
    }

    // Check if connected
    if (!this.state.voice.sessionId) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_CONNECTED, this.node.id, { guildId: this.guildId });
    }

    // Send update
    const sessionId = this.state.voice.sessionId!;
    await this.node.rest.updatePlayer(sessionId, this.guildId, payload);

    // Update local state
    this.state.currentTrack = typeof track === 'string' ? null : track;
    this.state.position = options.startTime ?? 0;
    this.state.paused = options.pauseAfter ?? false;
    this.state.lastUpdate = Date.now();
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    await this._updatePlayerState({ paused: true });
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    await this._updatePlayerState({ paused: false });
  }

  /**
   * Stop playback and clear queue
   */
  async stop(): Promise<void> {
    this.state.queue = [];
    await this._updatePlayerState({ encodedTrack: '' });
  }

  /**
   * Skip to next track
   */
  async skip(): Promise<void> {
    await this.play({});
  }

  /**
   * Seek to position in track
   */
  async seek(position: number): Promise<void> {
    if (this.destroyed) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
    }

    await this._updatePlayerState({ position });
  }

  /**
   * Set volume (0-1000)
   */
  async setVolume(volume: number): Promise<void> {
    if (volume < 0 || volume > 1000) {
      throw DavelinkError.fromPool(
        ErrorCode.VALIDATION_ERROR,
        this.node.id,
        { reason: 'Volume must be between 0 and 1000', volume }
      );
    }

    await this._updatePlayerState({ volume });
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Add track to queue
   */
  queueAdd(track: Track | string, position?: 'front' | 'back'): void {
    if (typeof track === 'string') {
      this.state.queue.push(track as unknown as Track);
    } else {
      this.state.queue.push(track);
    }
  }

  /**
   * Remove track from queue
   */
  queueRemove(index: number): Track | undefined {
    return this.state.queue.splice(index, 1)[0];
  }

  /**
   * Clear queue
   */
  queueClear(): void {
    this.state.queue = [];
  }

  /**
   * Get queue
   */
  queueGet(): Track[] {
    return [...this.state.queue];
  }

  /**
   * Shuffle queue
   */
  queueShuffle(): void {
    for (let i = this.state.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.queue[i], this.state.queue[j]] = [this.state.queue[j], this.state.queue[i]];
    }
  }

  // ============================================================================
  // Voice Controls
  // ============================================================================

  /**
   * Join a voice channel
   */
  async join(channelId: string): Promise<void> {
    this.state.channelId = channelId;
    // Note: Actual voice connection is handled by the Discord gateway
  }

  /**
   * Leave voice channel
   */
  async leave(): Promise<void> {
    this.state.channelId = null;
    await this._updatePlayerState({ encodedTrack: '' });
  }

  /**
   * Update voice state
   */
  async voiceUpdate(options: VoiceUpdateOptions): Promise<void> {
    if (options.sessionId) this.voiceState.sessionId = options.sessionId;
    if (options.token) this.voiceState.token = options.token;
    if (options.endpoint) this.voiceState.endpoint = options.endpoint;

    // Send voice update through WebSocket
    if (this.voiceState.sessionId && this.voiceState.token && this.voiceState.endpoint) {
      this.node.ws.sendVoiceUpdate(
        this.guildId,
        this.voiceState.sessionId,
        this.voiceState.token,
        this.voiceState.endpoint
      );
    }
  }

  // ============================================================================
  // Filters
  // ============================================================================

  /**
   * Set audio filters
   */
  async setFilters(filters: Filters): Promise<void> {
    if (this.destroyed) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
    }

    const payload: Record<string, unknown> = {};

    if (filters.volume !== undefined) {
      payload.volume = filters.volume;
    }

    if (filters.equalizer !== undefined) {
      payload.equalizer = filters.equalizer.map(band => ({
        band: band.band,
        gain: band.gain,
      }));
    }

    // Handle other filters...
    payload.filters = filters;

    const sessionId = this.state.voice.sessionId;
    if (sessionId) {
      await this.node.rest.updatePlayer(sessionId, this.guildId, payload);
    }

    this.state.filters = filters;
  }

  /**
   * Apply equalizer preset
   */
  async setEqualizer(bands: EqualizerBand[]): Promise<void> {
    await this.setFilters({ equalizer: bands });
  }

  /**
   * Clear all filters
   */
  async clearFilters(): Promise<void> {
    await this.setFilters({});
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  get currentTrack(): Track | null {
    return this.state.currentTrack;
  }

  get previousTrack(): Track | null {
    return this.state.previousTrack;
  }

  get position(): number {
    return this.state.position;
  }

  get paused(): boolean {
    return this.state.paused;
  }

  get volume(): number {
    return this.state.volume;
  }

  get channelId(): string | null {
    return this.state.channelId;
  }

  get queueLength(): number {
    return this.state.queue.length;
  }

  get isPlaying(): boolean {
    return this.state.currentTrack !== null && !this.state.paused;
  }

  get isPaused(): boolean {
    return this.state.paused;
  }

  get isConnected(): boolean {
    return this.state.voice.sessionId !== null;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Destroy the player
   */
  async destroy(): Promise<void> {
    if (this.destroyed) return;

    this.destroyed = true;

    // Destroy player on server
    const sessionId = this.state.voice.sessionId;
    if (sessionId) {
      try {
        await this.node.rest.destroyPlayer(sessionId, this.guildId);
      } catch {
        // Ignore errors during destroy
      }
    }

    // Clean up
    this.state.queue = [];
    voiceStatePool.release(this.voiceState);
    this.removeAllListeners();
  }

  /**
   * Update internal state from player update events
   */
  _updateFromPlayerUpdate(state: {
    volume?: number;
    position?: number;
    paused?: boolean;
  }): void {
    if (state.volume !== undefined) this.state.volume = state.volume;
    if (state.position !== undefined) this.state.position = state.position;
    if (state.paused !== undefined) this.state.paused = state.paused;
    this.state.lastUpdate = Date.now();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async _updatePlayerState(data: Record<string, unknown>): Promise<void> {
    if (this.destroyed) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
    }

    const sessionId = this.state.voice.sessionId;
    if (!sessionId) {
      throw DavelinkError.fromPool(ErrorCode.PLAYER_NOT_CONNECTED, this.node.id, { guildId: this.guildId });
    }

    await this.node.rest.updatePlayer(sessionId, this.guildId, data);

    // Update local state
    if (data.volume !== undefined) this.state.volume = data.volume as number;
    if (data.position !== undefined) this.state.position = data.position as number;
    if (data.paused !== undefined) this.state.paused = data.paused as boolean;
    if (data.encodedTrack !== undefined && data.encodedTrack === '') {
      this.state.currentTrack = null;
    }

    this.state.lastUpdate = Date.now();
  }

  private _setupEventForwarding(): void {
    this.node.ws.on('trackStart', (guildId, track) => {
      if (guildId === this.guildId) {
        this.emit('trackStart', this, track as unknown as Track);
      }
    });

    this.node.ws.on('trackEnd', (guildId, track, reason) => {
      if (guildId === this.guildId) {
        this.emit('trackEnd', this, track as unknown as Track, reason);

        // Auto-play next track
        if (this.state.autoPlay && this.state.queue.length > 0) {
          this.play({});
        } else if (this.state.queue.length === 0) {
          this.emit('queueEnd', this);
        }
      }
    });

    this.node.ws.on('trackException', (guildId, track, exception) => {
      if (guildId === this.guildId) {
        this.emit('trackException', this, track as unknown as Track, exception);
      }
    });

    this.node.ws.on('trackStuck', (guildId, track, thresholdMs) => {
      if (guildId === this.guildId) {
        this.emit('trackStuck', this, track as unknown as Track, thresholdMs);
      }
    });
  }
}

// ============================================================================
// Player Events Interface
// ============================================================================

interface PlayerEvents {
  trackStart: [player: Player, track: Track];
  trackEnd: [player: Player, track: Track, reason: string];
  trackException: [player: Player, track: Track, error: Record<string, unknown>];
  trackStuck: [player: Player, track: Track, thresholdMs: number];
  queueEnd: [player: Player];
  error: [error: DavelinkError];
}

// ============================================================================
// Player Manager
// ============================================================================

export class PlayerManager {
  private players: Map<string, Player> = new Map();
  private nodes: Map<string, Node> = new Map();

  constructor() {}

  /**
   * Register a node
   */
  registerNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Unregister a node
   */
  unregisterNode(nodeId: string): void {
    // Move all players from this node to another
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const playersToMove: Player[] = [];
    for (const player of this.players.values()) {
      if (player.node.id === nodeId) {
        playersToMove.push(player);
      }
    }

    // Move to first available node
    const availableNodes = Array.from(this.nodes.keys()).filter(id => id !== nodeId);
    if (availableNodes.length > 0) {
      const targetNode = this.nodes.get(availableNodes[0])!;
      for (const player of playersToMove) {
        // Recreate player on new node
        const newPlayer = new Player(player.guildId, targetNode, { guildId: player.guildId });
        this.players.set(player.guildId, newPlayer);
      }
    }

    this.nodes.delete(nodeId);
  }

  /**
   * Get or create a player
   */
  getPlayer(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  /**
   * Create a new player
   */
  createPlayer(guildId: string, nodeId?: string): Player {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    let node: Node | undefined;
    if (nodeId) {
      node = this.nodes.get(nodeId);
    }

    if (!node) {
      // Get node with lowest penalty
      node = this._selectBestNode();
    }

    if (!node) {
      throw DavelinkError.fromPool(ErrorCode.NODE_NOT_FOUND, undefined, { guildId });
    }

    const player = new Player(guildId, node, { guildId });
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Destroy a player
   */
  async destroyPlayer(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player) {
      await player.destroy();
      this.players.delete(guildId);
    }
  }

  /**
   * Get all players
   */
  getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Select best node based on load
   */
  private _selectBestNode(): Node | undefined {
    let bestNode: Node | undefined;
    let lowestPenalty = Infinity;

    for (const node of this.nodes.values()) {
      const penalty = node.getPenalty();
      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestNode = node;
      }
    }

    return bestNode;
  }
}