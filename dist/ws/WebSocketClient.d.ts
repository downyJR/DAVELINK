import type { NodeOptions } from '../types';
import { DavelinkError } from '../errors';
export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'ready' | 'stats' | 'playerUpdate' | 'trackStart' | 'trackEnd' | 'trackException' | 'trackStuck' | 'websocketClosed' | 'raw' | 'reconnecting';
export interface WebSocketEvents {
    open: [];
    close: [code: number, reason: string];
    error: [error: DavelinkError];
    message: [payload: unknown];
    ready: [sessionId: string, resumed: boolean];
    stats: [stats: Record<string, unknown>];
    playerUpdate: [guildId: string, state: Record<string, unknown>];
    trackStart: [guildId: string, track: string];
    trackEnd: [guildId: string, track: string, reason: string];
    trackException: [guildId: string, track: string, error: Record<string, unknown>];
    trackStuck: [guildId: string, track: string, thresholdMs: number];
    websocketClosed: [guildId: string, code: number, reason: string, byRemote: boolean];
    raw: [payload: unknown];
    reconnecting: [attempt: number];
}
export declare class WebSocketClient {
    private ws;
    private node;
    private userId;
    private resumeKey;
    private connected;
    private destroyed;
    private connecting;
    private sessionId;
    private resumeEnabled;
    private heartbeatInterval;
    private heartbeatAck;
    private reconnectTimer;
    private connectTimeout;
    private heartbeatTimer;
    private messageQueue;
    private messagePool;
    private backoff;
    private lastPingTime;
    private latency;
    private messagesReceived;
    private messagesSent;
    private listeners;
    private readonly userAgent;
    constructor(node: NodeOptions, userAgent?: string);
    /**
     * Connect to the WebSocket server
     */
    connect(userId?: string): void;
    /**
     * Disconnect from the WebSocket server
     */
    disconnect(code?: number, reason?: string): void;
    /**
     * Destroy the WebSocket client
     */
    destroy(): void;
    /**
     * Set the user ID for the connection
     */
    setUserId(userId: string): void;
    /**
     * Set the resume key for session resumption
     */
    setResumeKey(key: string): void;
    /**
     * Send a message through the WebSocket
     */
    send(data: unknown): boolean;
    /**
     * Send voice update to the server
     */
    sendVoiceUpdate(guildId: string, sessionId: string, token: string, endpoint: string): boolean;
    /**
     * Send player update to the server
     */
    sendPlayerUpdate(guildId: string, data: Record<string, unknown>): boolean;
    /**
     * Get the current session ID
     */
    getSessionId(): string | null;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get performance metrics
     */
    getMetrics(): {
        latency: number;
        messagesReceived: number;
        messagesSent: number;
        queueSize: number;
        connected: boolean;
        sessionId: string | null;
    };
    /**
     * Add event listener
     */
    on<K extends keyof WebSocketEvents>(event: K, listener: (...args: WebSocketEvents[K]) => void): this;
    /**
     * Add one-time event listener
     */
    once<K extends keyof WebSocketEvents>(event: K, listener: (...args: WebSocketEvents[K]) => void): this;
    /**
     * Remove event listener
     */
    off<K extends keyof WebSocketEvents>(event: K, listener: (...args: WebSocketEvents[K]) => void): this;
    private _setupEventHandlers;
    private _handleOpen;
    private _handleMessage;
    private _handleReady;
    private _handleEvent;
    private _handleClose;
    private _handleError;
    private _handleReconnect;
    private _handlePong;
    private _startHeartbeat;
    private _stopHeartbeat;
    private _flushMessageQueue;
    private _cleanup;
    private _emit;
    private _emitError;
}
export declare function createWebSocketClient(options: NodeOptions, userAgent?: string): WebSocketClient;
//# sourceMappingURL=WebSocketClient.d.ts.map