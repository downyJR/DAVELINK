import type { ManagerOptions, NodeOptions, LoadTracksResult, Track, Plugin, PerformanceMetrics } from './types';
import { TypedEventEmitter } from './core/EventEmitter';
import { NodeManager, Node } from './node/Node';
import { PlayerManager, Player } from './player/Player';
import { TrackCache } from './cache/TrackCache';
export declare class DavelinkManager extends TypedEventEmitter {
    readonly nodes: NodeManager;
    readonly players: PlayerManager;
    readonly cache: TrackCache;
    private options;
    private plugins;
    private userId;
    private destroyed;
    private startTime;
    private metricsHistory;
    private readonly maxMetricsHistory;
    constructor(options: ManagerOptions);
    /**
     * Initialize the manager with a user ID
     */
    init(userId: string): void;
    /**
     * Connect to all nodes
     */
    connect(): void;
    /**
     * Disconnect from all nodes
     */
    disconnect(): void;
    /**
     * Destroy the manager and all resources
     */
    destroy(): void;
    /**
     * Add a node
     */
    addNode(options: NodeOptions): Node;
    /**
     * Remove a node
     */
    removeNode(nodeId: string): boolean;
    /**
     * Get a node by ID
     */
    getNode(nodeId: string): Node | undefined;
    /**
     * Get all nodes
     */
    getNodes(): Node[];
    /**
     * Search for tracks
     */
    search(query: string, platform?: string): Promise<LoadTracksResult>;
    /**
     * Load tracks by URL or search query
     */
    loadTracks(identifier: string): Promise<LoadTracksResult>;
    /**
     * Decode a track
     */
    decodeTrack(encoded: string): Promise<Track>;
    /**
     * Get or create a player for a guild
     */
    getPlayer(guildId: string): Player;
    /**
     * Create a new player
     */
    createPlayer(guildId: string, nodeId?: string): Player;
    /**
     * Destroy a player
     */
    destroyPlayer(guildId: string): Promise<void>;
    /**
     * Load a plugin
     */
    loadPlugin(plugin: Plugin): void;
    /**
     * Unload a plugin
     */
    unloadPlugin(name: string): boolean;
    /**
     * Get all loaded plugins
     */
    getPlugins(): Plugin[];
    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Get historical metrics
     */
    getMetricsHistory(): PerformanceMetrics[];
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        trackCache: import("./cache/TrackCache").CacheStats;
        searchCache: import("./cache/TrackCache").CacheStats;
        totalMemoryEstimate: number;
    };
    /**
     * Get node statistics
     */
    getNodeStats(): Array<{
        id: string;
        penalty: number;
        players: number;
        latency: number;
        connected: boolean;
    }>;
    /**
     * Enable debug mode
     */
    enableDebug(): void;
    /**
     * Disable debug mode
     */
    disableDebug(): void;
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
    };
    private _setupNodeEvents;
    private _setupEventForwarding;
    private _recordMetrics;
    private _getEventLoopLatency;
    private _calculateMessageRate;
    private _calculateAvgResponseTime;
}
export declare const Davelink: typeof DavelinkManager;
export default DavelinkManager;
//# sourceMappingURL=Davelink.d.ts.map