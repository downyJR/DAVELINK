import type { NodeOptions, LoadTracksResult, NodeInfo, NodeStats, Track } from '../types';
export declare class RESTClient {
    private readonly options;
    private readonly baseURL;
    private readonly headers;
    private rateLimiter;
    private connectionPool;
    private requestTimings;
    private readonly maxTimings;
    private destroyed;
    constructor(options: NodeOptions, userAgent?: string);
    /**
     * Destroy the REST client
     */
    destroy(): void;
    /**
     * Load tracks by identifier or search query
     */
    loadTracks(identifier: string): Promise<LoadTracksResult>;
    /**
     * Decode a single track
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
     * Get node statistics
     */
    getStats(): Promise<NodeStats>;
    /**
     * Update a player
     */
    updatePlayer(sessionId: string, guildId: string, options: Record<string, unknown>, noReplace?: boolean): Promise<void>;
    /**
     * Destroy a player
     */
    destroyPlayer(sessionId: string, guildId: string): Promise<void>;
    /**
     * Update session configuration
     */
    updateSession(sessionId: string, config: {
        timeout?: number;
        resuming?: boolean;
    }): Promise<void>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get performance metrics
     */
    getMetrics(): {
        avgResponseTime: number;
        requestCount: number;
        rateLimitStatus: {
            tokens: number;
            queueLength: number;
        };
        connectionPoolStats: Record<string, {
            total: number;
            available: number;
        }>;
    };
    private _request;
    private _executeRequest;
    private _recordTiming;
}
export declare class RoutePlannerClient {
    private restClient;
    constructor(restClient: RESTClient);
    /**
     * Get route planner status
     */
    getStatus(): Promise<{
        class: string;
        details: Record<string, unknown>;
    }>;
    /**
     * Free an address from the route planner
     */
    freeAddress(address: string): Promise<void>;
}
//# sourceMappingURL=RESTClient.d.ts.map