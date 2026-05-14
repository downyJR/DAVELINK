"use strict";
// ============================================================================
// WebSocketClient - Robust Lavalink WebSocket with auto-reconnect
// Heartbeat monitoring, event parsing, exponential backoff
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const errors_1 = require("../errors");
const EventEmitter_1 = require("../core/EventEmitter");
class WebSocketClient extends EventEmitter_1.TypedEventEmitter {
    ws = null;
    node;
    url;
    headers;
    reconnectAttempt = 0;
    reconnectTimer = null;
    heartbeatInterval = null;
    heartbeatAck = true;
    destroyed = false;
    sessionId = null;
    connectTimeout = null;
    messageQueue = [];
    maxReconnectDelay = 30000; // 30 seconds max
    // Public state
    connected = false;
    constructor(node, _userAgent = "DALink/1.0.0") {
        super();
        this.node = node;
        this.url = `${node.secure ? "wss" : "ws"}://${node.hostname}:${node.port}/v4/websocket`;
        this.headers = {
            Authorization: node.password,
            "User-Id": "0",
            "Client-Name": _userAgent,
        };
    }
    setUserId(userId) {
        this.headers["User-Id"] = userId;
    }
    setResumeKey(resumeKey) {
        this.headers["Resume-Key"] = resumeKey;
    }
    connect() {
        if (this.destroyed) {
            this.emit("error", new errors_1.WebSocketError("WebSocket client has been destroyed", errors_1.ErrorCode.WS_CONNECTION_FAILED, this.node.id ?? "unknown"));
            return;
        }
        if (this.ws?.readyState === ws_1.default.OPEN) {
            return;
        }
        try {
            this.ws = new ws_1.default(this.url, {
                headers: this.headers,
            });
            this.connectTimeout = setTimeout(() => {
                this.ws?.terminate();
                this.handleReconnect("Connection timeout");
            }, 10000);
            this.ws.on("open", () => this.handleOpen());
            this.ws.on("message", (data) => this.handleMessage(data));
            this.ws.on("close", (code, reason) => this.handleClose(code, reason));
            this.ws.on("error", (error) => this.handleError(error));
            this.ws.on("ping", () => this.ws?.pong());
        }
        catch (error) {
            this.handleReconnect(error instanceof Error ? error.message : "Unknown connection error");
        }
    }
    send(data) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.messageQueue.push(data);
            return false;
        }
        try {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        catch (error) {
            this.emit("error", new errors_1.WebSocketError(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`, errors_1.ErrorCode.WS_MESSAGE_ERROR, this.node.id ?? "unknown"));
            this.messageQueue.push(data);
            return false;
        }
    }
    sendVoiceUpdate(guildId, sessionId, token, endpoint) {
        return this.send({
            op: "voiceUpdate",
            guildId,
            sessionId,
            event: { token, endpoint },
        });
    }
    sendPlayerUpdate(guildId, data) {
        return this.send({
            op: "play",
            guildId,
            ...data,
        });
    }
    /**
     * Destroy the WebSocket connection
     *
     * FIX: Check readyState before calling close().
     * When WebSocket is in CONNECTING state, calling close() causes
     * an asynchronous 'error' event after removeAllListeners() has run,
     * resulting in an unhandled error. Use terminate() for CONNECTING state.
     */
    destroy() {
        this.destroyed = true;
        this.stopHeartbeat();
        this.clearReconnectTimer();
        this.clearConnectTimeout();
        if (this.ws) {
            try {
                if (this.ws.readyState === ws_1.default.CONNECTING) {
                    // Force-terminate the socket without close handshake.
                    // Prevents "WebSocket was closed before the connection was established" error.
                    this.ws.terminate();
                }
                else if (this.ws.readyState === ws_1.default.OPEN) {
                    // Graceful close for established connections only.
                    this.ws.close(1000, "Client disconnecting");
                }
                // readyState CLOSING (2) or CLOSED (3): nothing to do
            }
            catch {
                // Ignore close errors
            }
            this.ws.removeAllListeners();
            this.ws = null;
        }
        this.connected = false;
        this.sessionId = null;
        this.messageQueue = [];
    }
    getSessionId() {
        return this.sessionId;
    }
    handleOpen() {
        this.clearConnectTimeout();
        this.connected = true;
        this.emit("open");
    }
    handleMessage(data) {
        try {
            const payload = JSON.parse(data.toString());
            this.emit("raw", payload);
            switch (payload.op) {
                case "ready": {
                    const ready = payload;
                    this.sessionId = ready.sessionId;
                    this.startHeartbeat();
                    this.emit("ready", ready.sessionId, ready.resumed);
                    this.emit("message", payload);
                    this.flushMessageQueue();
                    break;
                }
                case "stats": {
                    const stats = payload;
                    this.emit("stats", stats);
                    this.emit("message", payload);
                    break;
                }
                case "playerUpdate": {
                    const update = payload;
                    this.emit("playerUpdate", update.guildId, update.state);
                    this.emit("message", payload);
                    break;
                }
                case "event": {
                    this.handleEvent(payload);
                    this.emit("message", payload);
                    break;
                }
                default:
                    this.emit("message", payload);
            }
        }
        catch (error) {
            this.emit("error", new errors_1.WebSocketError(`Failed to parse message: ${error instanceof Error ? error.message : "Unknown error"}`, errors_1.ErrorCode.WS_MESSAGE_ERROR, this.node.id ?? "unknown"));
        }
    }
    handleEvent(payload) {
        switch (payload.type) {
            case "TrackStartEvent": {
                const e = payload;
                this.emit("trackStart", e.guildId, e.track);
                break;
            }
            case "TrackEndEvent": {
                const e = payload;
                this.emit("trackEnd", e.guildId, e.track, e.reason);
                break;
            }
            case "TrackExceptionEvent": {
                const e = payload;
                this.emit("trackException", e.guildId, e.track, e.exception);
                break;
            }
            case "TrackStuckEvent": {
                const e = payload;
                this.emit("trackStuck", e.guildId, e.track, e.thresholdMs);
                break;
            }
            case "WebSocketClosedEvent": {
                const e = payload;
                this.emit("websocketClosed", e.guildId, e.code, e.reason, e.byRemote);
                break;
            }
        }
    }
    handleClose(code, reason) {
        this.connected = false;
        this.clearConnectTimeout();
        this.stopHeartbeat();
        this.emit("close", code, reason.toString());
        if (this.destroyed || code === 1000 || code === 1001) {
            return;
        }
        if (code === 4001) {
            this.emit("error", new errors_1.WebSocketError("Authentication failed - check your password", errors_1.ErrorCode.NODE_AUTHENTICATION_FAILED, this.node.id ?? "unknown", false));
            return;
        }
        this.handleReconnect(`WebSocket closed with code ${code}: ${reason.toString()}`);
    }
    handleError(error) {
        this.emit("error", new errors_1.WebSocketError(error.message, errors_1.ErrorCode.WS_CONNECTION_FAILED, this.node.id ?? "unknown"));
    }
    handleReconnect(reason) {
        if (this.destroyed)
            return;
        this.reconnectAttempt++;
        const maxRetries = this.node.maxRetryAttempts ?? 10;
        if (this.reconnectAttempt > maxRetries) {
            this.emit("error", new errors_1.WebSocketError(`Max reconnection attempts (${maxRetries}) exceeded. Last reason: ${reason}`, errors_1.ErrorCode.NODE_MAX_RETRIES_EXCEEDED, this.node.id ?? "unknown", false));
            return;
        }
        const baseDelay = this.node.retryDelay ?? 5000;
        const delay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempt - 1) +
            Math.random() * 1000, this.maxReconnectDelay);
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.emit("error", new errors_1.WebSocketError(`Reconnecting... (attempt ${this.reconnectAttempt}/${maxRetries})`, errors_1.ErrorCode.NODE_DISCONNECTED, this.node.id ?? "unknown", true));
            this.connect();
        }, delay);
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatAck = true;
        this.heartbeatInterval = setInterval(() => {
            if (!this.heartbeatAck) {
                this.ws?.terminate();
                this.handleReconnect("Heartbeat timeout");
                return;
            }
            this.heartbeatAck = false;
            try {
                this.ws?.ping();
                this.heartbeatAck = true;
            }
            catch {
                this.handleReconnect("Failed to send heartbeat");
            }
        }, 30000);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    clearConnectTimeout() {
        if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
        }
    }
    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.connected) {
            const msg = this.messageQueue.shift();
            if (msg)
                this.send(msg);
        }
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=WebSocketClient.js.map