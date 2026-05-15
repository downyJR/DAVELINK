type Listener = (...args: unknown[]) => void;
export declare class TypedEventEmitter {
    private maxListeners;
    private listeners;
    private onceListeners;
    private _emitterDestroyed;
    constructor(maxListeners?: number);
    on(event: string, listener: Listener): void;
    once(event: string, listener: Listener): void;
    off(event: string, listener: Listener): void;
    emit(event: string, ...args: unknown[]): boolean;
    removeAllListeners(event?: string): void;
    setMaxListeners(n: number): void;
    listenerCount(event: string): number;
    eventNames(): string[];
    destroy(): void;
    private _handleError;
}
export {};
//# sourceMappingURL=EventEmitter.d.ts.map