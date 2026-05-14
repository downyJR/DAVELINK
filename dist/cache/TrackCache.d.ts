import type { Track } from '../types';
export declare class LRUCache<T> {
    private head;
    private tail;
    private map;
    private entryPool;
    private _size;
    private _hits;
    private _misses;
    readonly maxSize: number;
    readonly ttl: number;
    readonly name: string;
    constructor(options?: {
        maxSize?: number;
        ttl?: number;
        name?: string;
        preallocate?: number;
    });
    /**
     * Get a value from cache
     */
    get(key: string): T | undefined;
    /**
     * Set a value in cache
     */
    set(key: string, value: T, ttl?: number): void;
    /**
     * Check if key exists (without touching)
     */
    has(key: string): boolean;
    /**
     * Delete a key from cache
     */
    delete(key: string): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Estimate memory usage
     */
    private _estimateMemory;
    private _addToFront;
    private _removeEntry;
    private _touch;
    private _evictTail;
    /**
     * Clean up expired entries
     */
    cleanup(): number;
}
export interface CacheStats {
    name: string;
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryEstimate: number;
}
export declare class TrackCache {
    private cache;
    private searchCache;
    constructor(options?: {
        maxTracks?: number;
        trackTTL?: number;
        maxSearchResults?: number;
        searchTTL?: number;
    });
    /**
     * Get a track from cache
     */
    getTrack(encoded: string): Track | undefined;
    /**
     * Store a track in cache
     */
    setTrack(track: Track, ttl?: number): void;
    /**
     * Get cached search results
     */
    getSearchResults(query: string): Track[] | undefined;
    /**
     * Cache search results
     */
    setSearchResults(query: string, tracks: Track[], ttl?: number): void;
    /**
     * Check if track is cached
     */
    hasTrack(encoded: string): boolean;
    /**
     * Remove track from cache
     */
    removeTrack(encoded: string): boolean;
    /**
     * Clear all caches
     */
    clear(): void;
    /**
     * Get combined statistics
     */
    getStats(): {
        trackCache: CacheStats;
        searchCache: CacheStats;
        totalMemoryEstimate: number;
    };
    /**
     * Clean up expired entries
     */
    cleanup(): {
        tracks: number;
        searches: number;
    };
}
export declare const globalTrackCache: TrackCache;
//# sourceMappingURL=TrackCache.d.ts.map