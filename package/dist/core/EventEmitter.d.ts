type EventMap = Record<string, unknown[]>;
export declare class TypedEventEmitter<Events extends EventMap = EventMap> {
    private _listeners;
    private _onceListeners;
    private maxListeners;
    constructor(maxListeners?: number);
    on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this;
    once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this;
    off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this;
    emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean;
    listenerCount<K extends keyof Events>(event: K): number;
    listeners<K extends keyof Events>(event: K): Array<(...args: Events[K]) => void>;
    removeAllListeners<K extends keyof Events>(event?: K): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    eventNames(): (keyof Events | string)[];
}
export {};
//# sourceMappingURL=EventEmitter.d.ts.map