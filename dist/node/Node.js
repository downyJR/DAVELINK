"use strict";
// ============================================================================
// High-Performance Node Manager with Penalty-Based Load Balancing
// Efficient connection management, auto-reconnect, and health monitoring
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeManager = exports.Node = void 0;
const EventEmitter_1 = require("../core/EventEmitter");
const RESTClient_1 = require("../rest/RESTClient");
const WebSocketClient_1 = require("../ws/WebSocketClient");
// ============================================================================
// Node Class
// ============================================================================
class Node extends EventEmitter_1.TypedEventEmitter {
    id;
    hostname;
    port;
    password;
    secure;
    rest;
    ws;
    options;
    penalties = [];
    penaltyWindowSize = 10;
    stats = null;
    info = null;
    userId = '0';
    constructor(options, userAgent = 'Davelink/3.0.0') {
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
        this.rest = new RESTClient_1.RESTClient(options, userAgent);
        this.ws = new WebSocketClient_1.WebSocketClient(options, userAgent);
        // Setup event forwarding
        this._setupEventForwarding();
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Connect to the node
     */
    connect(userId) {
        if (userId)
            this.userId = userId;
        this.ws.connect(this.userId);
    }
    /**
     * Disconnect from the node
     */
    disconnect() {
        this.ws.disconnect();
    }
    /**
     * Destroy the node
     */
    destroy() {
        this.ws.destroy();
        this.rest.destroy();
        this.removeAllListeners();
    }
    /**
     * Check if node is connected
     */
    isConnected() {
        return this.ws.isConnected();
    }
    // ============================================================================
    // REST API Methods
    // ============================================================================
    /**
     * Load tracks by identifier
     */
    async loadTracks(identifier) {
        return this.rest.loadTracks(identifier);
    }
    /**
     * Decode a track
     */
    async decodeTrack(encodedTrack) {
        return this.rest.decodeTrack(encodedTrack);
    }
    /**
     * Decode multiple tracks
     */
    async decodeTracks(encodedTracks) {
        return this.rest.decodeTracks(encodedTracks);
    }
    /**
     * Get node info
     */
    async getInfo() {
        this.info = await this.rest.getInfo();
        return this.info;
    }
    /**
     * Get node stats
     */
    async getStats() {
        this.stats = await this.rest.getStats();
        this._updatePenalties();
        return this.stats;
    }
    /**
     * Health check
     */
    async healthCheck() {
        return this.rest.healthCheck();
    }
    // ============================================================================
    // Load Balancing
    // ============================================================================
    /**
     * Get node penalty for load balancing
     * Lower is better
     */
    getPenalty() {
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
    recordSuccess() {
        this.penalties.push(-1);
        if (this.penalties.length > this.penaltyWindowSize) {
            this.penalties.shift();
        }
    }
    /**
     * Record failed operation
     */
    recordFailure() {
        this.penalties.push(10);
        if (this.penalties.length > this.penaltyWindowSize) {
            this.penalties.shift();
        }
    }
    // ============================================================================
    // Getters
    // ============================================================================
    get sessionId() {
        return this.ws.getSessionId();
    }
    get latency() {
        const metrics = this.ws.getMetrics();
        return metrics.latency;
    }
    get playerCount() {
        return this.stats?.players ?? 0;
    }
    get playingPlayers() {
        return this.stats?.playingPlayers ?? 0;
    }
    get uptime() {
        return this.stats?.uptime ?? 0;
    }
    get memoryUsage() {
        return this.stats?.memory.used ?? 0;
    }
    get cpuLoad() {
        return this.stats?.cpu.processLoad ?? 0;
    }
    // ============================================================================
    // Event Forwarding
    // ============================================================================
    _setupEventForwarding() {
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
            this.stats = stats;
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
    _updatePenalties() {
        if (this.stats) {
            const penalty = this.stats.frameStats?.deficit ?? 0;
            this.penalties.push(penalty);
            if (this.penalties.length > this.penaltyWindowSize) {
                this.penalties.shift();
            }
        }
    }
}
exports.Node = Node;
// ============================================================================
// Node Manager
// ============================================================================
class NodeManager {
    nodes = new Map();
    currentIndex = 0;
    strategy = 'penalty';
    userId = '0';
    constructor() { }
    /**
     * Add a node
     */
    add(options) {
        const node = new Node(options);
        this.nodes.set(node.id, node);
        return node;
    }
    /**
     * Remove a node
     */
    remove(nodeId) {
        return this.nodes.delete(nodeId);
    }
    /**
     * Get a node by ID
     */
    get(nodeId) {
        return this.nodes.get(nodeId);
    }
    /**
     * Get all nodes
     */
    getNodes() {
        return Array.from(this.nodes.values());
    }
    /**
     * Get connected nodes
     */
    getConnectedNodes() {
        return Array.from(this.nodes.values()).filter(node => node.isConnected());
    }
    /**
     * Select best node based on strategy
     */
    select() {
        const connected = this.getConnectedNodes();
        if (connected.length === 0)
            return undefined;
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
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    /**
     * Set user ID for all nodes
     */
    setUserId(userId) {
        this.userId = userId;
        for (const node of this.nodes.values()) {
            node.connect(userId);
        }
    }
    /**
     * Connect all nodes
     */
    connectAll() {
        for (const node of this.nodes.values()) {
            node.connect(this.userId);
        }
    }
    /**
     * Disconnect all nodes
     */
    disconnectAll() {
        for (const node of this.nodes.values()) {
            node.disconnect();
        }
    }
    /**
     * Destroy all nodes
     */
    destroyAll() {
        for (const node of this.nodes.values()) {
            node.destroy();
        }
        this.nodes.clear();
    }
    /**
     * Get node count
     */
    getNodeCount() {
        return this.nodes.size;
    }
    /**
     * Get connected node count
     */
    getConnectedCount() {
        return this.getConnectedNodes().length;
    }
    // ============================================================================
    // Private Selection Methods
    // ============================================================================
    _selectByPenalty(nodes) {
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
    _selectRoundRobin(nodes) {
        const node = nodes[this.currentIndex % nodes.length];
        this.currentIndex++;
        return node;
    }
    _selectRandom(nodes) {
        return nodes[Math.floor(Math.random() * nodes.length)];
    }
}
exports.NodeManager = NodeManager;
//# sourceMappingURL=Node.js.map