// ============================================================================
// High-Performance Node Manager with Penalty-Based Load Balancing
// Efficient connection management, auto-reconnect, and health monitoring
// ============================================================================

import type { NodeOptions, NodeInfo, NodeStats, LoadTracksResult, Track } from '../types';
import { DavelinkError, ErrorCode } from '../errors';
import { TypedEventEmitter } from '../core/EventEmitter';
import { RESTClient } from '../rest/RESTClient';
import { WebSocketClient } from '../ws/WebSocketClient';

// ============================================================================
// Node Class
// ============================================================================

export class Node extends TypedEventEmitter {
  readonly id: string;
  readonly hostname: string;
  readonly port: number;
  readonly password: string;
  readonly secure: boolean;

  readonly rest: RESTClient;
  readonly ws: WebSocketClient;

  private options: Required<NodeOptions>;
  private penalties: number[] = [];
  private readonly penaltyWindowSize = 10;
  private stats: NodeStats | null = null;
  private info: NodeInfo | null = null;
  private userId: string = '0';

  constructor(options: NodeOptions, userAgent = 'Davelink/3.0.0') {
    super(100);

    this.id = options.id ?? `node-${Date.now()}`;
    this.hostname = options.hostname;
    this.port = options.port;
    this.password = options.password ?? 'youshallnotpass';
    this.secure = options.secure ?? false;

    this.options = {
      id: this.id,
      hostname: this.hostname,
      port: this.port,
      password: this.password,
      secure: this.secure,
      maxRetryAttempts: options.maxRetryAttempts ?? Infinity,
      retryDelay: options.retryDelay ?? 5000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      resumeEnabled: options.resumeEnabled ?? true,
      resumeTimeout: options.resumeTimeout ?? 60,
      requestTimeout: options.requestTimeout ?? 10000,
      userAgent: userAgent,
    };

    // Initialize clients
    this.rest = new RESTClient(options, userAgent);
    this.ws = new WebSocketClient(options, userAgent);

    // Setup event forwarding
    this._setupEventForwarding();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the node
   */
  connect(userId?: string): void {
    if (userId) this.userId = userId;
    this.ws.connect(this.userId);
  }

  /**
   * Disconnect from the node
   */
  disconnect(): void {
    this.ws.disconnect();
  }

  /**
   * Destroy the node
   */
  destroy(): void {
    this.ws.destroy();
    this.rest.destroy();
    this.removeAllListeners();
  }

  /**
   * Check if node is connected
   */
  isConnected(): boolean {
    return this.ws.isConnected();
  }

  // ============================================================================
  // REST API Methods
  // ============================================================================

  /**
   * Load tracks by identifier
   */
  async loadTracks(identifier: string): Promise<LoadTracksResult> {
    return this.rest.loadTracks(identifier);
  }

  /**
   * Decode a track
   */
  async decodeTrack(encodedTrack: string): Promise<Track> {
    return this.rest.decodeTrack(encodedTrack);
  }

  /**
   * Decode multiple tracks
   */
  async decodeTracks(encodedTracks: string[]): Promise<Track[]> {
    return this.rest.decodeTracks(encodedTracks);
  }

  /**
   * Get node info
   */
  async getInfo(): Promise<NodeInfo> {
    this.info = await this.rest.getInfo();
    return this.info;
  }

  /**
   * Get node stats
   */
  async getStats(): Promise<NodeStats> {
    this.stats = await this.rest.getStats();
    this._updatePenalties();
    return this.stats;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.rest.healthCheck();
  }

  // ============================================================================
  // Load Balancing
  // ============================================================================

  /**
   * Get node penalty for load balancing
   * Lower is better
   */
  getPenalty(): number {
    let penalty = 0;

    // Player penalty
    if (this.stats) {
      penalty += this.stats.players;

      // CPU penalty
      penalty += this.stats.cpu.systemLoad * 10;
      penalty += this.stats.cpu.processLoad * 5;

      // Frame stats penalty
      if (this.stats.frameStats) {
        penalty += this.stats.frameStats.deficit * 2;
        penalty += this.stats.frameStats.nulled;
      }
    }

    // Historical penalty from recent performance
    const historicalPenalty = this.penalties.reduce((a, b) => a + b, 0);
    penalty += historicalPenalty / Math.max(1, this.penalties.length);

    return penalty;
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    this.penalties.push(-1);
    if (this.penalties.length > this.penaltyWindowSize) {
      this.penalties.shift();
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(): void {
    this.penalties.push(10);
    if (this.penalties.length > this.penaltyWindowSize) {
      this.penalties.shift();
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get sessionId(): string | null {
    return this.ws.getSessionId();
  }

  get latency(): number {
    const metrics = this.ws.getMetrics();
    return metrics.latency;
  }

  get playerCount(): number {
    return this.stats?.players ?? 0;
  }

  get playingPlayers(): number {
    return this.stats?.playingPlayers ?? 0;
  }

  get uptime(): number {
    return this.stats?.uptime ?? 0;
  }

  get memoryUsage(): number {
    return this.stats?.memory.used ?? 0;
  }

  get cpuLoad(): number {
    return this.stats?.cpu.processLoad ?? 0;
  }

  // ============================================================================
  // Event Forwarding
  // ============================================================================

  private _setupEventForwarding(): void {
    // WebSocket events
    this.ws.on('open', () => {
      this.emit('open', this);
    });

    this.ws.on('close', (code, reason) => {
      this.emit('close', this, code, reason);
    });

    this.ws.on('error', (error) => {
      this.recordFailure();
      this.emit('error', this, error);
    });

    this.ws.on('ready', (sessionId, resumed) => {
      this.emit('ready', this, sessionId, resumed);
    });

    this.ws.on('reconnecting', (attempt) => {
      this.emit('reconnecting', this, attempt);
    });

    // Stats events
    this.ws.on('stats', (stats) => {
      this.stats = stats as unknown as NodeStats;
      this._updatePenalties();
    });

    // Forward player events
    this.ws.on('playerUpdate', (guildId, state) => {
      this.emit('playerUpdate', this, guildId, state);
    });

    this.ws.on('trackStart', (guildId, track) => {
      this.emit('trackStart', this, guildId, track);
    });

    this.ws.on('trackEnd', (guildId, track, reason) => {
      this.emit('trackEnd', this, guildId, track, reason);
    });

    this.ws.on('trackException', (guildId, track, exception) => {
      this.emit('trackException', this, guildId, track, exception);
    });

    this.ws.on('trackStuck', (guildId, track, thresholdMs) => {
      this.emit('trackStuck', this, guildId, track, thresholdMs);
    });

    this.ws.on('websocketClosed', (guildId, code, reason, byRemote) => {
      this.emit('websocketClosed', this, guildId, code, reason, byRemote);
    });
  }

  private _updatePenalties(): void {
    if (this.stats) {
      const penalty = this.stats.frameStats?.deficit ?? 0;
      this.penalties.push(penalty);
      if (this.penalties.length > this.penaltyWindowSize) {
        this.penalties.shift();
      }
    }
  }
}

// ============================================================================
// Node Events Interface
// ============================================================================

interface NodeEvents {
  open: [node: Node];
  close: [node: Node, code: number, reason: string];
  error: [node: Node, error: DavelinkError];
  ready: [node: Node, sessionId: string, resumed: boolean];
  reconnecting: [node: Node, attempt: number];
  playerUpdate: [node: Node, guildId: string, state: Record<string, unknown>];
  trackStart: [node: Node, guildId: string, track: string];
  trackEnd: [node: Node, guildId: string, track: string, reason: string];
  trackException: [node: Node, guildId: string, track: string, error: Record<string, unknown>];
  trackStuck: [node: Node, guildId: string, track: string, thresholdMs: number];
  websocketClosed: [node: Node, guildId: string, code: number, reason: string, byRemote: boolean];
}

// ============================================================================
// Node Manager
// ============================================================================

export class NodeManager {
  private nodes: Map<string, Node> = new Map();
  private currentIndex = 0;
  private strategy: 'penalty' | 'roundrobin' | 'random' = 'penalty';
  private userId = '0';

  constructor() {}

  /**
   * Add a node
   */
  add(options: NodeOptions): Node {
    const node = new Node(options);
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Remove a node
   */
  remove(nodeId: string): boolean {
    return this.nodes.delete(nodeId);
  }

  /**
   * Get a node by ID
   */
  get(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get connected nodes
   */
  getConnectedNodes(): Node[] {
    return Array.from(this.nodes.values()).filter(node => node.isConnected());
  }

  /**
   * Select best node based on strategy
   */
  select(): Node | undefined {
    const connected = this.getConnectedNodes();
    if (connected.length === 0) return undefined;

    switch (this.strategy) {
      case 'penalty':
        return this._selectByPenalty(connected);
      case 'roundrobin':
        return this._selectRoundRobin(connected);
      case 'random':
        return this._selectRandom(connected);
      default:
        return this._selectByPenalty(connected);
    }
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategy: 'penalty' | 'roundrobin' | 'random'): void {
    this.strategy = strategy;
  }

  /**
   * Set user ID for all nodes
   */
  setUserId(userId: string): void {
    this.userId = userId;
    for (const node of this.nodes.values()) {
      node.connect(userId);
    }
  }

  /**
   * Connect all nodes
   */
  connectAll(): void {
    for (const node of this.nodes.values()) {
      node.connect(this.userId);
    }
  }

  /**
   * Disconnect all nodes
   */
  disconnectAll(): void {
    for (const node of this.nodes.values()) {
      node.disconnect();
    }
  }

  /**
   * Destroy all nodes
   */
  destroyAll(): void {
    for (const node of this.nodes.values()) {
      node.destroy();
    }
    this.nodes.clear();
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get connected node count
   */
  getConnectedCount(): number {
    return this.getConnectedNodes().length;
  }

  // ============================================================================
  // Private Selection Methods
  // ============================================================================

  private _selectByPenalty(nodes: Node[]): Node {
    let best = nodes[0];
    let lowestPenalty = best.getPenalty();

    for (const node of nodes) {
      const penalty = node.getPenalty();
      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        best = node;
      }
    }

    return best;
  }

  private _selectRoundRobin(nodes: Node[]): Node {
    const node = nodes[this.currentIndex % nodes.length];
    this.currentIndex++;
    return node;
  }

  private _selectRandom(nodes: Node[]): Node {
    return nodes[Math.floor(Math.random() * nodes.length)];
  }
}