export type EventNames = string | symbol;
export type EventListener<T extends unknown[] = unknown[]> = (...args: T) => void;
interface ListenerEntry {
    listener: EventListener;
    once: boolean;
}
/**
 * High-performance event emitter with type safety
 */
export declare class TypedEventEmitter {
    private _listeners;
    private _onceListeners;
    private _maxListeners;
    private _eventNamesCache;
    constructor(maxListeners?: number);
    /**
     * Register an event listener
     */
    on(event: string, listener: EventListener): this;
    /**
     * Register a one-time event listener
     */
    once(event: string, listener: EventListener): this;
    /**
     * Remove an event listener
     */
    off(event: string, listener: EventListener): this;
    /**
     * Emit an event with arguments
     */
    emit(event: string, ...args: unknown[]): boolean;
    /**
     * Remove all listeners for an event or all events
     */
    removeAllListeners(event?: string): this;
    /**
     * Get listener count for an event
     */
    listenerCount(event: string): number;
    /**
     * Get all listeners for an event
     */
    listeners(event: string): EventListener[];
    /**
     * Set max listeners warning threshold
     */
    setMaxListeners(n: number): this;
    /**
     * Get max listeners setting
     */
    getMaxListeners(): number;
    /**
     * Get all registered event names
     */
    eventNames(): Array<string | symbol>;
    private _addListener;
    private _removeListener;
    private _emit;
    private _handleError;
    /**
     * Get raw listener entries for debugging
     */
    _getListenerEntries(event: string): {
        regular: ListenerEntry[];
        once: ListenerEntry[];
    };
    /**
     * Estimate memory usage for debugging
     */
    _estimateMemoryUsage(): number;
}
export {};
//# sourceMappingURL=EventEmitter.d.ts.map