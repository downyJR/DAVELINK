"use strict";
// ============================================================================
// High-Performance Player Manager with Memory Optimization
// Guild-specific playback sessions with efficient state management
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerManager = exports.Player = void 0;
const errors_1 = require("../errors");
const EventEmitter_1 = require("../core/EventEmitter");
// Object pool for voice states
class VoiceStatePool {
    pool = [];
    maxPoolSize = 100;
    acquire() {
        return this.pool.pop() ?? {
            channelId: null,
            sessionId: null,
            token: null,
            endpoint: null,
        };
    }
    release(state) {
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
const PLAYER_DEFAULTS = {
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
class Player extends EventEmitter_1.TypedEventEmitter {
    guildId;
    node;
    state;
    voiceState;
    destroyed = false;
    constructor(guildId, node, options = { guildId }) {
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
    async play(options = {}) {
        if (this.destroyed) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
        }
        let track = options.track;
        // Get from queue if no track provided
        if (!track && this.state.queue.length > 0) {
            track = this.state.queue.shift();
            this.state.previousTrack = this.state.currentTrack;
        }
        if (!track) {
            // No track available
            this.emit('queueEnd', this);
            return;
        }
        // Resolve track to encoded string
        const encodedTrack = typeof track === 'string' ? track : track.encoded;
        // Build player update payload
        const payload = {
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
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_CONNECTED, this.node.id, { guildId: this.guildId });
        }
        // Send update
        const sessionId = this.state.voice.sessionId;
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
    async pause() {
        await this._updatePlayerState({ paused: true });
    }
    /**
     * Resume playback
     */
    async resume() {
        await this._updatePlayerState({ paused: false });
    }
    /**
     * Stop playback and clear queue
     */
    async stop() {
        this.state.queue = [];
        await this._updatePlayerState({ encodedTrack: '' });
    }
    /**
     * Skip to next track
     */
    async skip() {
        await this.play({});
    }
    /**
     * Seek to position in track
     */
    async seek(position) {
        if (this.destroyed) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
        }
        await this._updatePlayerState({ position });
    }
    /**
     * Set volume (0-1000)
     */
    async setVolume(volume) {
        if (volume < 0 || volume > 1000) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.VALIDATION_ERROR, this.node.id, { reason: 'Volume must be between 0 and 1000', volume });
        }
        await this._updatePlayerState({ volume });
    }
    // ============================================================================
    // Queue Management
    // ============================================================================
    /**
     * Add track to queue
     */
    queueAdd(track, position) {
        if (typeof track === 'string') {
            this.state.queue.push(track);
        }
        else {
            this.state.queue.push(track);
        }
    }
    /**
     * Remove track from queue
     */
    queueRemove(index) {
        return this.state.queue.splice(index, 1)[0];
    }
    /**
     * Clear queue
     */
    queueClear() {
        this.state.queue = [];
    }
    /**
     * Get queue
     */
    queueGet() {
        return [...this.state.queue];
    }
    /**
     * Shuffle queue
     */
    queueShuffle() {
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
    async join(channelId) {
        this.state.channelId = channelId;
        // Note: Actual voice connection is handled by the Discord gateway
    }
    /**
     * Leave voice channel
     */
    async leave() {
        this.state.channelId = null;
        await this._updatePlayerState({ encodedTrack: '' });
    }
    /**
     * Update voice state
     */
    async voiceUpdate(options) {
        if (options.sessionId)
            this.voiceState.sessionId = options.sessionId;
        if (options.token)
            this.voiceState.token = options.token;
        if (options.endpoint)
            this.voiceState.endpoint = options.endpoint;
        // Send voice update through WebSocket
        if (this.voiceState.sessionId && this.voiceState.token && this.voiceState.endpoint) {
            this.node.ws.sendVoiceUpdate(this.guildId, this.voiceState.sessionId, this.voiceState.token, this.voiceState.endpoint);
        }
    }
    // ============================================================================
    // Filters
    // ============================================================================
    /**
     * Set audio filters
     */
    async setFilters(filters) {
        if (this.destroyed) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
        }
        const payload = {};
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
    async setEqualizer(bands) {
        await this.setFilters({ equalizer: bands });
    }
    /**
     * Clear all filters
     */
    async clearFilters() {
        await this.setFilters({});
    }
    // ============================================================================
    // State Getters
    // ============================================================================
    get currentTrack() {
        return this.state.currentTrack;
    }
    get previousTrack() {
        return this.state.previousTrack;
    }
    get position() {
        return this.state.position;
    }
    get paused() {
        return this.state.paused;
    }
    get volume() {
        return this.state.volume;
    }
    get channelId() {
        return this.state.channelId;
    }
    get queueLength() {
        return this.state.queue.length;
    }
    get isPlaying() {
        return this.state.currentTrack !== null && !this.state.paused;
    }
    get isPaused() {
        return this.state.paused;
    }
    get isConnected() {
        return this.state.voice.sessionId !== null;
    }
    // ============================================================================
    // Lifecycle
    // ============================================================================
    /**
     * Destroy the player
     */
    async destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        // Destroy player on server
        const sessionId = this.state.voice.sessionId;
        if (sessionId) {
            try {
                await this.node.rest.destroyPlayer(sessionId, this.guildId);
            }
            catch {
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
    _updateFromPlayerUpdate(state) {
        if (state.volume !== undefined)
            this.state.volume = state.volume;
        if (state.position !== undefined)
            this.state.position = state.position;
        if (state.paused !== undefined)
            this.state.paused = state.paused;
        this.state.lastUpdate = Date.now();
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async _updatePlayerState(data) {
        if (this.destroyed) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_FOUND, this.node.id, { guildId: this.guildId });
        }
        const sessionId = this.state.voice.sessionId;
        if (!sessionId) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.PLAYER_NOT_CONNECTED, this.node.id, { guildId: this.guildId });
        }
        await this.node.rest.updatePlayer(sessionId, this.guildId, data);
        // Update local state
        if (data.volume !== undefined)
            this.state.volume = data.volume;
        if (data.position !== undefined)
            this.state.position = data.position;
        if (data.paused !== undefined)
            this.state.paused = data.paused;
        if (data.encodedTrack !== undefined && data.encodedTrack === '') {
            this.state.currentTrack = null;
        }
        this.state.lastUpdate = Date.now();
    }
    _setupEventForwarding() {
        this.node.ws.on('trackStart', (guildId, track) => {
            if (guildId === this.guildId) {
                this.emit('trackStart', this, track);
            }
        });
        this.node.ws.on('trackEnd', (guildId, track, reason) => {
            if (guildId === this.guildId) {
                this.emit('trackEnd', this, track, reason);
                // Auto-play next track
                if (this.state.autoPlay && this.state.queue.length > 0) {
                    this.play({});
                }
                else if (this.state.queue.length === 0) {
                    this.emit('queueEnd', this);
                }
            }
        });
        this.node.ws.on('trackException', (guildId, track, exception) => {
            if (guildId === this.guildId) {
                this.emit('trackException', this, track, exception);
            }
        });
        this.node.ws.on('trackStuck', (guildId, track, thresholdMs) => {
            if (guildId === this.guildId) {
                this.emit('trackStuck', this, track, thresholdMs);
            }
        });
    }
}
exports.Player = Player;
// ============================================================================
// Player Manager
// ============================================================================
class PlayerManager {
    players = new Map();
    nodes = new Map();
    constructor() { }
    /**
     * Register a node
     */
    registerNode(node) {
        this.nodes.set(node.id, node);
    }
    /**
     * Unregister a node
     */
    unregisterNode(nodeId) {
        // Move all players from this node to another
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        const playersToMove = [];
        for (const player of this.players.values()) {
            if (player.node.id === nodeId) {
                playersToMove.push(player);
            }
        }
        // Move to first available node
        const availableNodes = Array.from(this.nodes.keys()).filter(id => id !== nodeId);
        if (availableNodes.length > 0) {
            const targetNode = this.nodes.get(availableNodes[0]);
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
    getPlayer(guildId) {
        return this.players.get(guildId);
    }
    /**
     * Create a new player
     */
    createPlayer(guildId, nodeId) {
        const existing = this.players.get(guildId);
        if (existing)
            return existing;
        let node;
        if (nodeId) {
            node = this.nodes.get(nodeId);
        }
        if (!node) {
            // Get node with lowest penalty
            node = this._selectBestNode();
        }
        if (!node) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_NOT_FOUND, undefined, { guildId });
        }
        const player = new Player(guildId, node, { guildId });
        this.players.set(guildId, player);
        return player;
    }
    /**
     * Destroy a player
     */
    async destroyPlayer(guildId) {
        const player = this.players.get(guildId);
        if (player) {
            await player.destroy();
            this.players.delete(guildId);
        }
    }
    /**
     * Get all players
     */
    getPlayers() {
        return Array.from(this.players.values());
    }
    /**
     * Get player count
     */
    getPlayerCount() {
        return this.players.size;
    }
    /**
     * Select best node based on load
     */
    _selectBestNode() {
        let bestNode;
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
exports.PlayerManager = PlayerManager;
//# sourceMappingURL=Player.js.map