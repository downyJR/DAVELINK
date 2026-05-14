import type { NodeOptions, NodeInfo, NodeStats, LoadTracksResult, Track } from '../types';
import { TypedEventEmitter } from '../core/EventEmitter';
import { RESTClient } from '../rest/RESTClient';
import { WebSocketClient } from '../ws/WebSocketClient';
export declare class Node extends TypedEventEmitter {
    readonly id: string;
    readonly hostname: string;
    readonly port: number;
    readonly password: string;
    readonly secure: boolean;
    readonly rest: RESTClient;
    readonly ws: WebSocketClient;
    private options;
    private penalties;
    private readonly penaltyWindowSize;
    private stats;
    private info;
    private userId;
    constructor(options: NodeOptions, userAgent?: string);
    /**
     * Connect to the node
     */
    connect(userId?: string): void;
    /**
     * Disconnect from the node
     */
    disconnect(): void;
    /**
     * Destroy the node
     */
    destroy(): void;
    /**
     * Check if node is connected
     */
    isConnected(): boolean;
    /**
     * Load tracks by identifier
     */
    loadTracks(identifier: string): Promise<LoadTracksResult>;
    /**
     * Decode a track
     */
    decodeTrack(encodedTrack: string): Promise<Track>;
    /**
     * Decode multiple tracks
     */
    decodeTracks(encodedTracks: string[]): Promise<Track[]>;
    /**
     * Get node info
     */
    getInfo(): Promise<NodeInfo>;
    /**
     * Get node stats
     */
    getStats(): Promise<NodeStats>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get node penalty for load balancing
     * Lower is better
     */
    getPenalty(): number;
    /**
     * Record successful operation
     */
    recordSuccess(): void;
    /**
     * Record failed operation
     */
    recordFailure(): void;
    get sessionId(): string | null;
    get latency(): number;
    get playerCount(): number;
    get playingPlayers(): number;
    get uptime(): number;
    get memoryUsage(): number;
    get cpuLoad(): number;
    private _setupEventForwarding;
    private _updatePenalties;
}
export declare class NodeManager {
    private nodes;
    private currentIndex;
    private strategy;
    private userId;
    constructor();
    /**
     * Add a node
     */
    add(options: NodeOptions): Node;
    /**
     * Remove a node
     */
    remove(nodeId: string): boolean;
    /**
     * Get a node by ID
     */
    get(nodeId: string): Node | undefined;
    /**
     * Get all nodes
     */
    getNodes(): Node[];
    /**
     * Get connected nodes
     */
    getConnectedNodes(): Node[];
    /**
     * Select best node based on strategy
     */
    select(): Node | undefined;
    /**
     * Set load balancing strategy
     */
    setStrategy(strategy: 'penalty' | 'roundrobin' | 'random'): void;
    /**
     * Set user ID for all nodes
     */
    setUserId(userId: string): void;
    /**
     * Connect all nodes
     */
    connectAll(): void;
    /**
     * Disconnect all nodes
     */
    disconnectAll(): void;
    /**
     * Destroy all nodes
     */
    destroyAll(): void;
    /**
     * Get node count
     */
    getNodeCount(): number;
    /**
     * Get connected node count
     */
    getConnectedCount(): number;
    private _selectByPenalty;
    private _selectRoundRobin;
    private _selectRandom;
}
//# sourceMappingURL=Node.d.ts.map