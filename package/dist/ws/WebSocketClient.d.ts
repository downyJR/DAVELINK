import type { NodeOptions, LavalinkEvent, TrackData, PlayerState } from "../types";
import { TypedEventEmitter } from "../core/EventEmitter";
interface WSMessage {
    op: string;
    [key: string]: unknown;
}
export declare class WebSocketClient extends TypedEventEmitter<{
    open: [];
    close: [code: number, reason: string];
    error: [error: Error];
    message: [data: LavalinkEvent];
    raw: [data: Record<string, unknown>];
    ready: [sessionId: string, resumed: boolean];
    stats: [data: {
        players: number;
        playingPlayers: number;
        uptime: number;
        memory: Record<string, unknown>;
        cpu: Record<string, unknown>;
        frameStats?: Record<string, unknown>;
    }];
    playerUpdate: [guildId: string, state: PlayerState];
    trackStart: [guildId: string, track: TrackData];
    trackEnd: [guildId: string, track: TrackData, reason: string];
    trackException: [guildId: string, track: TrackData, exception: {
        message: string;
        severity: string;
        cause: string;
    }];
    trackStuck: [guildId: string, track: TrackData, thresholdMs: number];
    websocketClosed: [guildId: string, code: number, reason: string, byRemote: boolean];
}> {
    private ws;
    private node;
    private url;
    private headers;
    private reconnectAttempt;
    private reconnectTimer;
    private heartbeatInterval;
    private heartbeatAck;
    private destroyed;
    private sessionId;
    private connectTimeout;
    private messageQueue;
    private maxReconnectDelay;
    connected: boolean;
    constructor(node: NodeOptions, _userAgent?: string);
    setUserId(userId: string): void;
    setResumeKey(resumeKey: string): void;
    connect(): void;
    send(data: WSMessage): boolean;
    sendVoiceUpdate(guildId: string, sessionId: string, token: string, endpoint: string): boolean;
    sendPlayerUpdate(guildId: string, data: Record<string, unknown>): boolean;
    /**
     * Destroy the WebSocket connection
     *
     * FIX: Check readyState before calling close().
     * When WebSocket is in CONNECTING state, calling close() causes
     * an asynchronous 'error' event after removeAllListeners() has run,
     * resulting in an unhandled error. Use terminate() for CONNECTING state.
     */
    destroy(): void;
    getSessionId(): string | null;
    private handleOpen;
    private handleMessage;
    private handleEvent;
    private handleClose;
    private handleError;
    private handleReconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private clearReconnectTimer;
    private clearConnectTimeout;
    private flushMessageQueue;
}
export {};
//# sourceMappingURL=WebSocketClient.d.ts.map