"use strict";
// ============================================================================
// High-Performance Davelink Manager - Main Entry Point
// Orchestrates nodes, players, cache, plugins, and events
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Davelink = exports.DavelinkManager = void 0;
const errors_1 = require("./errors");
const EventEmitter_1 = require("./core/EventEmitter");
const Node_1 = require("./node/Node");
const Player_1 = require("./player/Player");
const TrackCache_1 = require("./cache/TrackCache");
// ============================================================================
// Default Configuration
// ============================================================================
const DEFAULT_OPTIONS = {
    nodes: [],
    defaultSearchPlatform: 'ytsearch',
    autoReconnect: true,
    loadBalancer: 'penalty',
    debug: false,
    cache: {
        enabled: true,
        maxSize: 10000,
        ttl: 3600000,
        preloadSearch: false,
    },
    rateLimit: {
        maxRequestsPerSecond: 10,
        bucketSize: 20,
        retryDelay: 1000,
    },
    userId: '0',
};
// ============================================================================
// Davelink Manager
// ============================================================================
class DavelinkManager extends EventEmitter_1.TypedEventEmitter {
    nodes;
    players;
    cache;
    options;
    plugins = [];
    userId = '0';
    destroyed = false;
    // Performance tracking
    startTime = Date.now();
    metricsHistory = [];
    maxMetricsHistory = 100;
    constructor(options) {
        super(100);
        // Apply defaults
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            cache: { ...DEFAULT_OPTIONS.cache, ...options.cache },
            rateLimit: { ...DEFAULT_OPTIONS.rateLimit, ...options.rateLimit },
        };
        // Initialize managers
        this.nodes = new Node_1.NodeManager();
        this.players = new Player_1.PlayerManager();
        this.cache = new TrackCache_1.TrackCache({
            maxTracks: this.options.cache.maxSize,
            trackTTL: this.options.cache.ttl,
            maxSearchResults: 1000,
            searchTTL: this.options.cache.ttl / 2,
        });
        // Add nodes
        for (const nodeOptions of this.options.nodes) {
            const node = this.nodes.add(nodeOptions);
            this.players.registerNode(node);
            this._setupNodeEvents(node);
        }
        // Set load balancing strategy
        this.nodes.setStrategy(this.options.loadBalancer);
        // Setup manager-level event forwarding
        this._setupEventForwarding();
    }
    // ============================================================================
    // Initialization
    // ============================================================================
    /**
     * Initialize the manager with a user ID
     */
    init(userId) {
        this.userId = userId;
        this.nodes.setUserId(userId);
    }
    /**
     * Connect to all nodes
     */
    connect() {
        this.nodes.connectAll();
    }
    /**
     * Disconnect from all nodes
     */
    disconnect() {
        this.nodes.disconnectAll();
    }
    /**
     * Destroy the manager and all resources
     */
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        // Unload plugins
        for (const plugin of this.plugins) {
            if (plugin.unload) {
                plugin.unload();
            }
        }
        // Destroy all players
        for (const player of this.players.getPlayers()) {
            player.destroy();
        }
        // Destroy all nodes
        this.nodes.destroyAll();
        // Clear cache
        this.cache.clear();
        // Clear metrics
        this.metricsHistory = [];
        this.removeAllListeners();
    }
    // ============================================================================
    // Node Management
    // ============================================================================
    /**
     * Add a node
     */
    addNode(options) {
        const node = this.nodes.add(options);
        this.players.registerNode(node);
        this._setupNodeEvents(node);
        node.connect(this.userId);
        return node;
    }
    /**
     * Remove a node
     */
    removeNode(nodeId) {
        this.players.unregisterNode(nodeId);
        const node = this.nodes.get(nodeId);
        if (node) {
            node.destroy();
        }
        return this.nodes.remove(nodeId);
    }
    /**
     * Get a node by ID
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    /**
     * Get all nodes
     */
    getNodes() {
        return this.nodes.getNodes();
    }
    // ============================================================================
    // Track Operations
    // ============================================================================
    /**
     * Search for tracks
     */
    async search(query, platform) {
        // Check cache first
        const cacheKey = `${platform ?? this.options.defaultSearchPlatform}:${query}`;
        const cached = this.cache.getSearchResults(cacheKey);
        if (cached) {
            return { loadType: 'search', data: cached };
        }
        // Get best node
        const node = this.nodes.select();
        if (!node) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
        }
        // Load tracks
        const identifier = `${platform ?? this.options.defaultSearchPlatform}:${query}`;
        const result = await node.loadTracks(identifier);
        // Cache results
        if (result.loadType === 'search' && Array.isArray(result.data)) {
            this.cache.setSearchResults(cacheKey, result.data);
            for (const track of result.data) {
                this.cache.setTrack(track);
            }
        }
        else if (result.loadType === 'track' && result.data) {
            const track = result.data;
            this.cache.setTrack(track);
        }
        node.recordSuccess();
        return result;
    }
    /**
     * Load tracks by URL or search query
     */
    async loadTracks(identifier) {
        const node = this.nodes.select();
        if (!node) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
        }
        const result = await node.loadTracks(identifier);
        // Cache tracks
        if (result.loadType === 'search' && Array.isArray(result.data)) {
            for (const track of result.data) {
                this.cache.setTrack(track);
            }
        }
        else if (result.loadType === 'track' && result.data) {
            const track = result.data;
            this.cache.setTrack(track);
        }
        node.recordSuccess();
        return result;
    }
    /**
     * Decode a track
     */
    async decodeTrack(encoded) {
        // Check cache
        const cached = this.cache.getTrack(encoded);
        if (cached)
            return cached;
        const node = this.nodes.select();
        if (!node) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
        }
        const track = await node.decodeTrack(encoded);
        this.cache.setTrack(track);
        node.recordSuccess();
        return track;
    }
    // ============================================================================
    // Player Management
    // ============================================================================
    /**
     * Get or create a player for a guild
     */
    getPlayer(guildId) {
        let player = this.players.getPlayer(guildId);
        if (!player) {
            const node = this.nodes.select();
            if (!node) {
                throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_NOT_FOUND, undefined, { guildId });
            }
            player = this.players.createPlayer(guildId);
        }
        return player;
    }
    /**
     * Create a new player
     */
    createPlayer(guildId, nodeId) {
        return this.players.createPlayer(guildId, nodeId);
    }
    /**
     * Destroy a player
     */
    async destroyPlayer(guildId) {
        await this.players.destroyPlayer(guildId);
    }
    // ============================================================================
    // Plugin System
    // ============================================================================
    /**
     * Load a plugin
     */
    loadPlugin(plugin) {
        this.plugins.push(plugin);
        plugin.load(this);
    }
    /**
     * Unload a plugin
     */
    unloadPlugin(name) {
        const index = this.plugins.findIndex(p => p.name === name);
        if (index === -1)
            return false;
        const plugin = this.plugins[index];
        if (plugin.unload) {
            plugin.unload();
        }
        this.plugins.splice(index, 1);
        return true;
    }
    /**
     * Get all loaded plugins
     */
    getPlugins() {
        return [...this.plugins];
    }
    // ============================================================================
    // Performance Metrics
    // ============================================================================
    /**
     * Get current performance metrics
     */
    getMetrics() {
        const memUsage = process.memoryUsage();
        return {
            memoryUsage: memUsage.heapUsed,
            cpuUsage: process.cpuUsage().user / 1000000,
            eventLoopLatency: this._getEventLoopLatency(),
            messageRate: this._calculateMessageRate(),
            avgResponseTime: this._calculateAvgResponseTime(),
            playerCount: this.players.getPlayerCount(),
            timestamp: Date.now(),
        };
    }
    /**
     * Get historical metrics
     */
    getMetricsHistory() {
        return [...this.metricsHistory];
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cache.getStats();
    }
    /**
     * Get node statistics
     */
    getNodeStats() {
        return this.nodes.getNodes().map(node => ({
            id: node.id,
            penalty: node.getPenalty(),
            players: node.playerCount,
            latency: node.latency,
            connected: node.isConnected(),
        }));
    }
    // ============================================================================
    // Debug
    // ============================================================================
    /**
     * Enable debug mode
     */
    enableDebug() {
        this.options.debug = true;
    }
    /**
     * Disable debug mode
     */
    disableDebug() {
        this.options.debug = false;
    }
    /**
     * Get debug info
     */
    getDebugInfo() {
        return {
            uptime: Date.now() - this.startTime,
            nodes: this.nodes.getNodeCount(),
            connectedNodes: this.nodes.getConnectedCount(),
            players: this.players.getPlayerCount(),
            plugins: this.plugins.length,
            cacheStats: this.cache.getStats(),
            memoryUsage: process.memoryUsage(),
        };
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    _setupNodeEvents(node) {
        node.on('ready', (n, sessionId, resumed) => {
            if (this.options.debug) {
                console.log(`[Davelink] Node ${n.id} ready (session: ${sessionId}, resumed: ${resumed})`);
            }
            this.emit('nodeReady', n, resumed);
        });
        node.on('close', (n, code, reason) => {
            if (this.options.debug) {
                console.log(`[Davelink] Node ${n.id} disconnected (${code}: ${reason})`);
            }
            this.emit('nodeDisconnect', n, code, reason);
            // Auto reconnect
            if (this.options.autoReconnect && code !== 1000 && code !== 1001) {
                setTimeout(() => node.connect(this.userId), 5000);
            }
        });
        node.on('error', (n, error) => {
            if (this.options.debug) {
                console.error(`[Davelink] Node ${n.id} error:`, error.message);
            }
            this.emit('nodeError', n, error);
        });
        node.on('reconnecting', (n, attempt) => {
            if (this.options.debug) {
                console.log(`[Davelink] Node ${n.id} reconnecting (attempt ${attempt})`);
            }
        });
        // Forward player events
        node.on('trackStart', (n, guildId, track) => {
            const player = this.players.getPlayer(String(guildId));
            if (player) {
                this.emit('trackStart', player, track);
            }
        });
        node.on('trackEnd', (n, guildId, track, reason) => {
            const player = this.players.getPlayer(String(guildId));
            if (player) {
                this.emit('trackEnd', player, track, String(reason));
            }
        });
        node.on('trackException', (n, guildId, track, exception) => {
            const player = this.players.getPlayer(String(guildId));
            if (player) {
                const trackException = exception;
                this.emit('trackException', player, track, trackException);
            }
        });
        node.on('trackStuck', (n, guildId, track, thresholdMs) => {
            const player = this.players.getPlayer(String(guildId));
            if (player) {
                this.emit('trackStuck', player, track, Number(thresholdMs));
            }
        });
    }
    _setupEventForwarding() {
        this.on('error', (error) => {
            if (this.options.debug) {
                console.error('[Davelink] Manager error:', error.message);
            }
        });
    }
    _recordMetrics() {
        const metrics = this.getMetrics();
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxMetricsHistory) {
            this.metricsHistory.shift();
        }
    }
    _getEventLoopLatency() {
        // Simple approximation using setTimeout precision
        const start = process.hrtime.bigint();
        // This is a placeholder - real implementation would use performance hooks
        return 0;
    }
    _calculateMessageRate() {
        let total = 0;
        for (const node of this.nodes.getNodes()) {
            const metrics = node.ws.getMetrics();
            total += metrics.messagesReceived + metrics.messagesSent;
        }
        return total;
    }
    _calculateAvgResponseTime() {
        let total = 0;
        let count = 0;
        for (const node of this.nodes.getNodes()) {
            const metrics = node.rest.getMetrics();
            if (metrics.avgResponseTime > 0) {
                total += metrics.avgResponseTime;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    }
}
exports.DavelinkManager = DavelinkManager;
// ============================================================================
// Default Export
// ============================================================================
exports.Davelink = DavelinkManager;
exports.default = DavelinkManager;
//# sourceMappingURL=Davelink.js.map