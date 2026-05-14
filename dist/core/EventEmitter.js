"use strict";
// ============================================================================
// High-Performance TypedEventEmitter with Memory Optimization
// Object pooling, efficient listeners map, minimal allocations
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedEventEmitter = void 0;
// Pre-allocated empty array for reuse
const EMPTY_LISTENERS = [];
/**
 * High-performance event emitter with type safety
 */
class TypedEventEmitter {
    // Use array-based storage for better memory efficiency
    _listeners = new Map();
    _onceListeners = new Map();
    _maxListeners = 100;
    _eventNamesCache = null;
    constructor(maxListeners = 100) {
        this._maxListeners = maxListeners;
    }
    /**
     * Register an event listener
     */
    on(event, listener) {
        return this._addListener(event, listener, false);
    }
    /**
     * Register a one-time event listener
     */
    once(event, listener) {
        return this._addListener(event, listener, true);
    }
    /**
     * Remove an event listener
     */
    off(event, listener) {
        return this._removeListener(event, listener);
    }
    /**
     * Emit an event with arguments
     */
    emit(event, ...args) {
        return this._emit(event, args);
    }
    /**
     * Remove all listeners for an event or all events
     */
    removeAllListeners(event) {
        if (event !== undefined) {
            this._listeners.delete(event);
            this._onceListeners.delete(event);
            this._eventNamesCache = null;
        }
        else {
            this._listeners.clear();
            this._onceListeners.clear();
            this._eventNamesCache = null;
        }
        return this;
    }
    /**
     * Get listener count for an event
     */
    listenerCount(event) {
        const regular = this._listeners.get(event);
        const once = this._onceListeners.get(event);
        return (regular?.length ?? 0) + (once?.length ?? 0);
    }
    /**
     * Get all listeners for an event
     */
    listeners(event) {
        const regular = this._listeners.get(event) ?? EMPTY_LISTENERS;
        const once = this._onceListeners.get(event) ?? EMPTY_LISTENERS;
        const result = [];
        for (const entry of regular) {
            result.push(entry.listener);
        }
        for (const entry of once) {
            result.push(entry.listener);
        }
        return result;
    }
    /**
     * Set max listeners warning threshold
     */
    setMaxListeners(n) {
        this._maxListeners = n;
        return this;
    }
    /**
     * Get max listeners setting
     */
    getMaxListeners() {
        return this._maxListeners;
    }
    /**
     * Get all registered event names
     */
    eventNames() {
        if (this._eventNamesCache) {
            return this._eventNamesCache;
        }
        const keys = new Set();
        for (const key of this._listeners.keys()) {
            keys.add(key);
        }
        for (const key of this._onceListeners.keys()) {
            keys.add(key);
        }
        this._eventNamesCache = Array.from(keys);
        return this._eventNamesCache;
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    _addListener(event, listener, once) {
        // Validate inputs
        if (typeof listener !== 'function') {
            throw new TypeError('Listener must be a function');
        }
        const targetMap = once ? this._onceListeners : this._listeners;
        let entries = targetMap.get(event);
        if (!entries) {
            entries = [];
            targetMap.set(event, entries);
        }
        // Check max listeners
        const totalCount = (this._listeners.get(event)?.length ?? 0) + entries.length + 1;
        if (totalCount > this._maxListeners) {
            console.warn(`MaxListenersExceededWarning: ${totalCount} listeners for "${event}". Potential memory leak.`);
        }
        entries.push({ listener, once });
        this._eventNamesCache = null;
        return this;
    }
    _removeListener(event, listener) {
        // Remove from regular listeners
        const regular = this._listeners.get(event);
        if (regular) {
            const idx = regular.findIndex(e => e.listener === listener);
            if (idx !== -1) {
                regular.splice(idx, 1);
                if (regular.length === 0) {
                    this._listeners.delete(event);
                }
            }
        }
        // Remove from once listeners
        const once = this._onceListeners.get(event);
        if (once) {
            const idx = once.findIndex(e => e.listener === listener);
            if (idx !== -1) {
                once.splice(idx, 1);
                if (once.length === 0) {
                    this._onceListeners.delete(event);
                }
            }
        }
        this._eventNamesCache = null;
        return this;
    }
    _emit(event, args) {
        const regular = this._listeners.get(event);
        const once = this._onceListeners.get(event);
        const regularCount = regular?.length ?? 0;
        const onceCount = once?.length ?? 0;
        if (regularCount === 0 && onceCount === 0) {
            return false;
        }
        // Copy listeners to avoid mutation during emission
        const toCall = [];
        if (regularCount > 0) {
            for (let i = 0; i < regularCount; i++) {
                toCall.push(regular[i]);
            }
        }
        if (onceCount > 0) {
            for (let i = 0; i < onceCount; i++) {
                toCall.push(once[i]);
            }
        }
        // Clear once listeners for this event immediately
        if (onceCount > 0) {
            this._onceListeners.delete(event);
        }
        // Call all listeners
        for (const entry of toCall) {
            try {
                entry.listener(...args);
            }
            catch (error) {
                // Emit error asynchronously
                process.nextTick(() => {
                    this._handleError(error);
                });
            }
        }
        return true;
    }
    _handleError(error) {
        const errorListeners = this._listeners.get('error');
        if (errorListeners) {
            for (const entry of errorListeners) {
                try {
                    entry.listener(error);
                }
                catch {
                    // Last resort - log to console
                    console.error('Unhandled error in error listener:', error);
                }
            }
        }
        else {
            console.error('Unhandled error:', error);
        }
    }
    /**
     * Get raw listener entries for debugging
     */
    _getListenerEntries(event) {
        return {
            regular: this._listeners.get(event) ?? [],
            once: this._onceListeners.get(event) ?? []
        };
    }
    /**
     * Estimate memory usage for debugging
     */
    _estimateMemoryUsage() {
        let size = 0;
        // Map overhead
        size += 64; // Approximate Map overhead
        for (const [, entries] of this._listeners) {
            size += 56; // Entry overhead
            size += entries.length * 48; // ListenerEntry size estimate
        }
        for (const [, entries] of this._onceListeners) {
            size += 56;
            size += entries.length * 48;
        }
        return size;
    }
}
exports.TypedEventEmitter = TypedEventEmitter;
//# sourceMappingURL=EventEmitter.js.map