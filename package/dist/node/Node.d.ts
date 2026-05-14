import type { NodeOptions } from "../types";
import { WebSocketClient } from "../ws/WebSocketClient";
import { TypedEventEmitter } from "../core/EventEmitter";
export declare class Node extends TypedEventEmitter<Record<string, unknown[]>> {
    readonly id: string;
    readonly options: NodeOptions;
    private rest;
    ws: WebSocketClient;
    constructor(options: NodeOptions, userAgent?: string);
    connect(userId: string): void;
    disconnect(): void;
    destroy(): void;
}
//# sourceMappingURL=Node.d.ts.map