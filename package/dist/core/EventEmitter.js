"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedEventEmitter = void 0;
class TypedEventEmitter {
    _listeners;
    _onceListeners;
    maxListeners;
    constructor(maxListeners = 100) {
        this._listeners = new Map();
        this._onceListeners = new Map();
        this.maxListeners = maxListeners;
    }
    on(event, listener) {
        const key = String(event);
        const existing = this._listeners.get(key) || [];
        if (existing.length >= this.maxListeners) {
            console.warn(`MaxListenersExceededWarning: Possible event memory leak detected.`);
        }
        existing.push(listener);
        this._listeners.set(key, existing);
        return this;
    }
    once(event, listener) {
        this.on(event, listener);
        const key = String(event);
        const onceSet = this._onceListeners.get(key) || new Set();
        onceSet.add(listener);
        this._onceListeners.set(key, onceSet);
        return this;
    }
    off(event, listener) {
        const key = String(event);
        const existing = this._listeners.get(key);
        if (!existing)
            return this;
        const filtered = existing.filter((l) => l !== listener);
        this._listeners.set(key, filtered);
        const onceSet = this._onceListeners.get(key);
        if (onceSet) {
            onceSet.delete(listener);
        }
        return this;
    }
    emit(event, ...args) {
        const key = String(event);
        const listeners = this._listeners.get(key);
        if (!listeners || listeners.length === 0)
            return false;
        const onceSet = this._onceListeners.get(key);
        const toRemove = [];
        const snapshot = [...listeners];
        for (const listener of snapshot) {
            try {
                listener(...args);
            }
            catch (error) {
                process.nextTick(() => {
                    const errorListeners = this._listeners.get("error");
                    if (errorListeners) {
                        for (const el of [...errorListeners]) {
                            try {
                                el(error);
                            }
                            catch { /* ignore */ }
                        }
                    }
                });
            }
            if (onceSet?.has(listener)) {
                toRemove.push(listener);
            }
        }
        for (const listener of toRemove) {
            this.off(event, listener);
        }
        return true;
    }
    listenerCount(event) {
        const key = String(event);
        const listeners = this._listeners.get(key);
        return listeners ? listeners.length : 0;
    }
    listeners(event) {
        const key = String(event);
        const listeners = this._listeners.get(key);
        return listeners ? [...listeners] : [];
    }
    removeAllListeners(event) {
        if (event) {
            this._listeners.delete(String(event));
            this._onceListeners.delete(String(event));
        }
        else {
            this._listeners.clear();
            this._onceListeners.clear();
        }
        return this;
    }
    setMaxListeners(n) {
        this.maxListeners = n;
        return this;
    }
    getMaxListeners() {
        return this.maxListeners;
    }
    eventNames() {
        return Array.from(this._listeners.keys());
    }
}
exports.TypedEventEmitter = TypedEventEmitter;
//# sourceMappingURL=EventEmitter.js.map