// ============================================================================
// High-Performance Davelink Manager - Main Entry Point
// Orchestrates nodes, players, cache, plugins, and events
// ============================================================================

import type {
  ManagerOptions,
  NodeOptions,
  LoadTracksResult,
  Track,
  Plugin,
  ManagerEvents,
  PerformanceMetrics,
} from './types';
import { DavelinkError, ErrorCode } from './errors';
import { TypedEventEmitter } from './core/EventEmitter';
import { NodeManager, Node } from './node/Node';
import { PlayerManager, Player } from './player/Player';
import { TrackCache } from './cache/TrackCache';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<ManagerOptions> = {
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

export class DavelinkManager extends TypedEventEmitter {
  readonly nodes: NodeManager;
  readonly players: PlayerManager;
  readonly cache: TrackCache;

  private options: Required<ManagerOptions>;
  private plugins: Plugin[] = [];
  private userId: string = '0';
  private destroyed = false;

  // Performance tracking
  private startTime = Date.now();
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 100;

  constructor(options: ManagerOptions) {
    super(100);

    // Apply defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      cache: { ...DEFAULT_OPTIONS.cache, ...options.cache },
      rateLimit: { ...DEFAULT_OPTIONS.rateLimit, ...options.rateLimit },
    };

    // Initialize managers
    this.nodes = new NodeManager();
    this.players = new PlayerManager();
    this.cache = new TrackCache({
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
  init(userId: string): void {
    this.userId = userId;
    this.nodes.setUserId(userId);
  }

  /**
   * Connect to all nodes
   */
  connect(): void {
    this.nodes.connectAll();
  }

  /**
   * Disconnect from all nodes
   */
  disconnect(): void {
    this.nodes.disconnectAll();
  }

  /**
   * Destroy the manager and all resources
   */
  destroy(): void {
    if (this.destroyed) return;
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
  addNode(options: NodeOptions): Node {
    const node = this.nodes.add(options);
    this.players.registerNode(node);
    this._setupNodeEvents(node);
    node.connect(this.userId);
    return node;
  }

  /**
   * Remove a node
   */
  removeNode(nodeId: string): boolean {
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
  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getNodes(): Node[] {
    return this.nodes.getNodes();
  }

  // ============================================================================
  // Track Operations
  // ============================================================================

  /**
   * Search for tracks
   */
  async search(query: string, platform?: string): Promise<LoadTracksResult> {
    // Check cache first
    const cacheKey = `${platform ?? this.options.defaultSearchPlatform}:${query}`;
    const cached = this.cache.getSearchResults(cacheKey);
    if (cached) {
      return { loadType: 'search', data: cached };
    }

    // Get best node
    const node = this.nodes.select();
    if (!node) {
      throw DavelinkError.fromPool(ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
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
    } else if (result.loadType === 'track' && result.data) {
      const track = result.data as Track;
      this.cache.setTrack(track);
    }

    node.recordSuccess();
    return result;
  }

  /**
   * Load tracks by URL or search query
   */
  async loadTracks(identifier: string): Promise<LoadTracksResult> {
    const node = this.nodes.select();
    if (!node) {
      throw DavelinkError.fromPool(ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
    }

    const result = await node.loadTracks(identifier);

    // Cache tracks
    if (result.loadType === 'search' && Array.isArray(result.data)) {
      for (const track of result.data) {
        this.cache.setTrack(track);
      }
    } else if (result.loadType === 'track' && result.data) {
      const track = result.data as Track;
      this.cache.setTrack(track);
    }

    node.recordSuccess();
    return result;
  }

  /**
   * Decode a track
   */
  async decodeTrack(encoded: string): Promise<Track> {
    // Check cache
    const cached = this.cache.getTrack(encoded);
    if (cached) return cached;

    const node = this.nodes.select();
    if (!node) {
      throw DavelinkError.fromPool(ErrorCode.NODE_NOT_FOUND, undefined, { reason: 'No available nodes' });
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
  getPlayer(guildId: string): Player {
    let player = this.players.getPlayer(guildId);
    if (!player) {
      const node = this.nodes.select();
      if (!node) {
        throw DavelinkError.fromPool(ErrorCode.NODE_NOT_FOUND, undefined, { guildId });
      }
      player = this.players.createPlayer(guildId);
    }
    return player;
  }

  /**
   * Create a new player
   */
  createPlayer(guildId: string, nodeId?: string): Player {
    return this.players.createPlayer(guildId, nodeId);
  }

  /**
   * Destroy a player
   */
  async destroyPlayer(guildId: string): Promise<void> {
    await this.players.destroyPlayer(guildId);
  }

  // ============================================================================
  // Plugin System
  // ============================================================================

  /**
   * Load a plugin
   */
  loadPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
    plugin.load(this);
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(name: string): boolean {
    const index = this.plugins.findIndex(p => p.name === name);
    if (index === -1) return false;

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
  getPlugins(): Plugin[] {
    return [...this.plugins];
  }

  // ============================================================================
  // Performance Metrics
  // ============================================================================

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
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
  getMetricsHistory(): PerformanceMetrics[] {
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
  getNodeStats(): Array<{
    id: string;
    penalty: number;
    players: number;
    latency: number;
    connected: boolean;
  }> {
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
  enableDebug(): void {
    this.options.debug = true;
  }

  /**
   * Disable debug mode
   */
  disableDebug(): void {
    this.options.debug = false;
  }

  /**
   * Get debug info
   */
  getDebugInfo(): {
    uptime: number;
    nodes: number;
    connectedNodes: number;
    players: number;
    plugins: number;
    cacheStats: ReturnType<TrackCache['getStats']>;
    memoryUsage: NodeJS.MemoryUsage;
  } {
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

  private _setupNodeEvents(node: Node): void {
    node.on('ready', (n: Node, sessionId: unknown, resumed: unknown) => {
      if (this.options.debug) {
        console.log(`[Davelink] Node ${n.id} ready (session: ${sessionId}, resumed: ${resumed})`);
      }
      this.emit('nodeReady', n as unknown as Node, resumed as boolean);
    });

    node.on('close', (n: Node, code: unknown, reason: unknown) => {
      if (this.options.debug) {
        console.log(`[Davelink] Node ${n.id} disconnected (${code}: ${reason})`);
      }
      this.emit('nodeDisconnect', n as unknown as Node, code as number, reason as string);

      // Auto reconnect
      if (this.options.autoReconnect && (code as number) !== 1000 && (code as number) !== 1001) {
        setTimeout(() => node.connect(this.userId), 5000);
      }
    });

    node.on('error', (n: Node, error: Error) => {
      if (this.options.debug) {
        console.error(`[Davelink] Node ${n.id} error:`, error.message);
      }
      this.emit('nodeError', n as unknown as Node, error);
    });

    node.on('reconnecting', (n: Node, attempt: unknown) => {
      if (this.options.debug) {
        console.log(`[Davelink] Node ${n.id} reconnecting (attempt ${attempt})`);
      }
    });

    // Forward player events
    node.on('trackStart', (n: Node, guildId: unknown, track: unknown) => {
      const player = this.players.getPlayer(String(guildId));
      if (player) {
        this.emit('trackStart', player, track as unknown as Track);
      }
    });

    node.on('trackEnd', (n: Node, guildId: unknown, track: unknown, reason: unknown) => {
      const player = this.players.getPlayer(String(guildId));
      if (player) {
        this.emit('trackEnd', player, track as unknown as Track, String(reason));
      }
    });

    node.on('trackException', (n: Node, guildId: unknown, track: unknown, exception: unknown) => {
      const player = this.players.getPlayer(String(guildId));
      if (player) {
        const trackException = exception as { message: string; severity: string; cause?: string };
        this.emit('trackException', player as unknown as Player, track as unknown as Track, trackException);
      }
    });

    node.on('trackStuck', (n: Node, guildId: unknown, track: unknown, thresholdMs: unknown) => {
      const player = this.players.getPlayer(String(guildId));
      if (player) {
        this.emit('trackStuck', player, track as unknown as Track, Number(thresholdMs));
      }
    });
  }

  private _setupEventForwarding(): void {
    this.on('error', (error: unknown) => {
      if (this.options.debug) {
        console.error('[Davelink] Manager error:', (error as Error).message);
      }
    });
  }

  private _recordMetrics(): void {
    const metrics = this.getMetrics();
    this.metricsHistory.push(metrics);

    if (this.metricsHistory.length > this.maxMetricsHistory) {
      this.metricsHistory.shift();
    }
  }

  private _getEventLoopLatency(): number {
    // Simple approximation using setTimeout precision
    const start = process.hrtime.bigint();
    // This is a placeholder - real implementation would use performance hooks
    return 0;
  }

  private _calculateMessageRate(): number {
    let total = 0;
    for (const node of this.nodes.getNodes()) {
      const metrics = node.ws.getMetrics();
      total += metrics.messagesReceived + metrics.messagesSent;
    }
    return total;
  }

  private _calculateAvgResponseTime(): number {
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

// ============================================================================
// Default Export
// ============================================================================

export const Davelink = DavelinkManager;
export default DavelinkManager;