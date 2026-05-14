"use strict";
// ============================================================================
// High-Performance Cache System with Memory Optimization
// LRU cache with object pooling for minimal GC pressure
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalTrackCache = exports.TrackCache = exports.LRUCache = void 0;
class EntryPool {
    pool = [];
    maxPoolSize = 1000;
    acquire() {
        return this.pool.pop() ?? {
            key: '',
            value: null,
            expiry: 0,
            hits: 0,
            prev: null,
            next: null,
        };
    }
    release(entry) {
        if (this.pool.length < this.maxPoolSize) {
            entry.key = '';
            entry.value = null;
            entry.expiry = 0;
            entry.hits = 0;
            entry.prev = null;
            entry.next = null;
            this.pool.push(entry);
        }
    }
    preallocate(count) {
        for (let i = 0; i < count; i++) {
            this.pool.push({
                key: '',
                value: null,
                expiry: 0,
                hits: 0,
                prev: null,
                next: null,
            });
        }
    }
}
// ============================================================================
// LRU Cache Implementation
// ============================================================================
class LRUCache {
    head = null;
    tail = null;
    map = new Map();
    entryPool = new EntryPool();
    _size = 0;
    _hits = 0;
    _misses = 0;
    maxSize;
    ttl;
    name;
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 1000;
        this.ttl = options.ttl ?? 3600000; // 1 hour default
        this.name = options.name ?? 'LRUCache';
        if (options.preallocate) {
            this.entryPool.preallocate(options.preallocate);
        }
    }
    /**
     * Get a value from cache
     */
    get(key) {
        const entry = this.map.get(key);
        if (!entry) {
            this._misses++;
            return undefined;
        }
        // Check expiry
        if (Date.now() > entry.expiry) {
            this.delete(key);
            this._misses++;
            return undefined;
        }
        // Move to front (most recently used)
        this._touch(entry);
        entry.hits++;
        this._hits++;
        return entry.value;
    }
    /**
     * Set a value in cache
     */
    set(key, value, ttl) {
        const now = Date.now();
        const expiry = now + (ttl ?? this.ttl);
        // Check if key exists
        const existing = this.map.get(key);
        if (existing) {
            existing.value = value;
            existing.expiry = expiry;
            this._touch(existing);
            existing.hits++;
            return;
        }
        // Create new entry
        const entry = this.entryPool.acquire();
        entry.key = key;
        entry.value = value;
        entry.expiry = expiry;
        entry.hits = 1;
        // Add to map and list
        this.map.set(key, entry);
        this._addToFront(entry);
        this._size++;
        // Evict if over capacity
        while (this._size > this.maxSize && this.tail) {
            this._evictTail();
        }
    }
    /**
     * Check if key exists (without touching)
     */
    has(key) {
        const entry = this.map.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiry) {
            this.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete a key from cache
     */
    delete(key) {
        const entry = this.map.get(key);
        if (!entry)
            return false;
        this._removeEntry(entry);
        this.map.delete(key);
        this.entryPool.release(entry);
        this._size--;
        return true;
    }
    /**
     * Clear all entries
     */
    clear() {
        let entry = this.head;
        while (entry) {
            const next = entry.next;
            this.entryPool.release(entry);
            entry = next;
        }
        this.head = null;
        this.tail = null;
        this.map.clear();
        this._size = 0;
        this._hits = 0;
        this._misses = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this._hits + this._misses;
        return {
            name: this.name,
            size: this._size,
            maxSize: this.maxSize,
            hits: this._hits,
            misses: this._misses,
            hitRate: total > 0 ? this._hits / total : 0,
            memoryEstimate: this._estimateMemory(),
        };
    }
    /**
     * Estimate memory usage
     */
    _estimateMemory() {
        // Rough estimate: 200 bytes per entry + key overhead
        let estimate = 64; // Map overhead
        estimate += this._size * (200 + 16); // Entry + average key length
        return estimate;
    }
    // ============================================================================
    // Linked List Operations
    // ============================================================================
    _addToFront(entry) {
        entry.next = this.head;
        entry.prev = null;
        if (this.head) {
            this.head.prev = entry;
        }
        this.head = entry;
        if (!this.tail) {
            this.tail = entry;
        }
    }
    _removeEntry(entry) {
        if (entry.prev) {
            entry.prev.next = entry.next;
        }
        else {
            this.head = entry.next;
        }
        if (entry.next) {
            entry.next.prev = entry.prev;
        }
        else {
            this.tail = entry.prev;
        }
        entry.prev = null;
        entry.next = null;
    }
    _touch(entry) {
        if (entry !== this.head) {
            this._removeEntry(entry);
            this._addToFront(entry);
        }
    }
    _evictTail() {
        if (!this.tail)
            return;
        const entry = this.tail;
        this.tail = entry.prev;
        if (entry.prev) {
            entry.prev.next = null;
        }
        else {
            this.head = null;
        }
        this.map.delete(entry.key);
        this.entryPool.release(entry);
        this._size--;
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        while (this.tail && this.tail.expiry < now) {
            const entry = this.tail;
            this.tail = entry.prev;
            if (entry.prev) {
                entry.prev.next = null;
            }
            else {
                this.head = null;
            }
            this.map.delete(entry.key);
            this.entryPool.release(entry);
            this._size--;
            cleaned++;
        }
        return cleaned;
    }
}
exports.LRUCache = LRUCache;
// ============================================================================
// Track Cache Specialized Implementation
// ============================================================================
class TrackCache {
    cache;
    searchCache;
    constructor(options = {}) {
        this.cache = new LRUCache({
            maxSize: options.maxTracks ?? 10000,
            ttl: options.trackTTL ?? 3600000,
            name: 'TrackCache',
        });
        this.searchCache = new LRUCache({
            maxSize: (options.maxSearchResults ?? 1000),
            ttl: options.searchTTL ?? 1800000,
            name: 'SearchCache',
        });
    }
    /**
     * Get a track from cache
     */
    getTrack(encoded) {
        return this.cache.get(encoded);
    }
    /**
     * Store a track in cache
     */
    setTrack(track, ttl) {
        this.cache.set(track.encoded, track, ttl);
    }
    /**
     * Get cached search results
     */
    getSearchResults(query) {
        return this.searchCache.get(query);
    }
    /**
     * Cache search results
     */
    setSearchResults(query, tracks, ttl) {
        this.searchCache.set(query, tracks, ttl);
    }
    /**
     * Check if track is cached
     */
    hasTrack(encoded) {
        return this.cache.has(encoded);
    }
    /**
     * Remove track from cache
     */
    removeTrack(encoded) {
        return this.cache.delete(encoded);
    }
    /**
     * Clear all caches
     */
    clear() {
        this.cache.clear();
        this.searchCache.clear();
    }
    /**
     * Get combined statistics
     */
    getStats() {
        const trackStats = this.cache.getStats();
        const searchStats = this.searchCache.getStats();
        return {
            trackCache: trackStats,
            searchCache: searchStats,
            totalMemoryEstimate: trackStats.memoryEstimate + searchStats.memoryEstimate,
        };
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        return {
            tracks: this.cache.cleanup(),
            searches: this.searchCache.cleanup(),
        };
    }
}
exports.TrackCache = TrackCache;
// ============================================================================
// Global Track Cache Instance
// ============================================================================
exports.globalTrackCache = new TrackCache();
//# sourceMappingURL=TrackCache.js.map