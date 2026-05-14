"use strict";
// ============================================================================
// High-Performance WebSocket Client with Memory Optimization
// Zero-copy parsing, minimal allocations, efficient reconnection
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
exports.createWebSocketClient = createWebSocketClient;
const ws_1 = __importDefault(require("ws"));
const errors_1 = require("../errors");
// Object pool for parsed messages
class MessagePool {
    pool = [];
    maxPoolSize = 500;
    acquire() {
        return this.pool.pop() ?? { op: '' };
    }
    release(msg) {
        if (this.pool.length < this.maxPoolSize) {
            // Clear all properties efficiently
            for (const key in msg) {
                delete msg[key];
            }
            msg.op = '';
            this.pool.push(msg);
        }
    }
}
class ExponentialBackoff {
    attempt = 0;
    config;
    constructor(config = {}) {
        this.config = {
            baseDelay: config.baseDelay ?? 1000,
            maxDelay: config.maxDelay ?? 30000,
            multiplier: config.multiplier ?? 1.5,
            jitter: config.jitter ?? 1000,
        };
    }
    /**
     * Get delay for current attempt
     */
    getDelay() {
        this.attempt++;
        const exponentialDelay = this.config.baseDelay * Math.pow(this.config.multiplier, this.attempt - 1);
        const jitter = Math.random() * this.config.jitter;
        return Math.min(exponentialDelay + jitter, this.config.maxDelay);
    }
    /**
     * Reset backoff state
     */
    reset() {
        this.attempt = 0;
    }
    /**
     * Get current attempt number
     */
    getAttempt() {
        return this.attempt;
    }
}
// ============================================================================
// High-Performance WebSocket Client
// ============================================================================
class WebSocketClient {
    // Connection state
    ws = null;
    node;
    userId = '0';
    resumeKey = null;
    // State flags
    connected = false;
    destroyed = false;
    connecting = false;
    // Session management
    sessionId = null;
    resumeEnabled = true;
    // Timers (stored as numbers for quick comparison)
    heartbeatInterval = null;
    heartbeatAck = true;
    reconnectTimer = null;
    connectTimeout = null;
    heartbeatTimer = 30000; // 30 seconds
    // Message handling
    messageQueue = [];
    messagePool = new MessagePool();
    // Backoff strategy
    backoff = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 30000,
        multiplier: 1.5,
        jitter: 500,
    });
    // Performance metrics
    lastPingTime = 0;
    latency = 0;
    messagesReceived = 0;
    messagesSent = 0;
    // Event listeners (optimized storage)
    listeners = new Map();
    // User agent
    userAgent;
    constructor(node, userAgent = 'Davelink/3.0.0') {
        this.node = {
            id: node.id ?? `node-${Date.now()}`,
            hostname: node.hostname,
            port: node.port,
            password: node.password ?? 'youshallnotpass',
            secure: node.secure ?? false,
            maxRetryAttempts: node.maxRetryAttempts ?? Infinity,
            retryDelay: node.retryDelay ?? 5000,
            maxReconnectDelay: node.maxReconnectDelay ?? 30000,
            resumeEnabled: node.resumeEnabled ?? true,
            resumeTimeout: node.resumeTimeout ?? 60,
            requestTimeout: node.requestTimeout ?? 10000,
            userAgent,
        };
        this.userAgent = userAgent;
        this.resumeEnabled = this.node.resumeEnabled;
    }
    // ============================================================================
    // Public API
    // ============================================================================
    /**
     * Connect to the WebSocket server
     */
    connect(userId) {
        if (this.destroyed) {
            this._emitError(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.WS_CONNECTION_FAILED, this.node.id, { reason: 'Client has been destroyed' }));
            return;
        }
        if (this.connected || this.connecting) {
            return;
        }
        if (userId) {
            this.userId = userId;
        }
        this.connecting = true;
        const url = `${this.node.secure ? 'wss' : 'ws'}://${this.node.hostname}:${this.node.port}/v4/websocket`;
        const headers = {
            'Authorization': this.node.password,
            'User-Id': this.userId,
            'Client-Name': this.userAgent,
        };
        if (this.resumeKey && this.resumeEnabled) {
            headers['Resume-Key'] = this.resumeKey;
        }
        // Set connection timeout
        this.connectTimeout = setTimeout(() => {
            this.ws?.terminate();
            this._handleReconnect('Connection timeout (10s)');
        }, 10000);
        try {
            this.ws = new ws_1.default(url, {
                headers,
                handshakeTimeout: 10000,
                // Enable permessage-deflate compression
                perMessageDeflate: true,
            });
            this._setupEventHandlers();
        }
        catch (error) {
            clearTimeout(this.connectTimeout);
            this.connecting = false;
            this._handleReconnect(error instanceof Error ? error.message : 'Unknown error');
        }
    }
    /**
     * Disconnect from the WebSocket server
     */
    disconnect(code = 1000, reason = 'Client disconnecting') {
        if (this.destroyed)
            return;
        this._cleanup();
        this.ws?.close(code, reason);
    }
    /**
     * Destroy the WebSocket client
     */
    destroy() {
        this.destroyed = true;
        this._cleanup();
        if (this.ws) {
            // Check readyState before calling close
            if (this.ws.readyState === ws_1.default.CONNECTING) {
                this.ws.terminate();
            }
            else if (this.ws.readyState === ws_1.default.OPEN) {
                this.ws.close(1000, 'Client destroyed');
            }
            this.ws.removeAllListeners();
            this.ws = null;
        }
        // Clear all listeners
        this.listeners.clear();
        this.messageQueue = [];
    }
    /**
     * Set the user ID for the connection
     */
    setUserId(userId) {
        this.userId = userId;
    }
    /**
     * Set the resume key for session resumption
     */
    setResumeKey(key) {
        this.resumeKey = key;
        // Note: Resume key is sent during initial connection handshake
        // If already connected, the new connection will use this key
        if (!this.connected) {
            // Key will be used on next connect
        }
    }
    /**
     * Send a message through the WebSocket
     */
    send(data) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.messageQueue.push(data);
            return false;
        }
        try {
            this.ws.send(JSON.stringify(data));
            this.messagesSent++;
            return true;
        }
        catch (error) {
            this.messageQueue.push(data);
            return false;
        }
    }
    /**
     * Send voice update to the server
     */
    sendVoiceUpdate(guildId, sessionId, token, endpoint) {
        return this.send({
            op: 'voiceUpdate',
            guildId,
            sessionId,
            event: { token, endpoint },
        });
    }
    /**
     * Send player update to the server
     */
    sendPlayerUpdate(guildId, data) {
        return this.send({
            op: 'playerUpdate',
            guildId,
            ...data,
        });
    }
    /**
     * Get the current session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected && this.ws?.readyState === ws_1.default.OPEN;
    }
    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            latency: this.latency,
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            queueSize: this.messageQueue.length,
            connected: this.connected,
            sessionId: this.sessionId,
        };
    }
    // ============================================================================
    // Event System
    // ============================================================================
    /**
     * Add event listener
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        return this;
    }
    /**
     * Add one-time event listener
     */
    once(event, listener) {
        const onceListener = (...args) => {
            this.off(event, onceListener);
            listener(...args);
        };
        return this.on(event, onceListener);
    }
    /**
     * Remove event listener
     */
    off(event, listener) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
        return this;
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    _setupEventHandlers() {
        if (!this.ws)
            return;
        this.ws.on('open', () => this._handleOpen());
        this.ws.on('message', (data) => this._handleMessage(data));
        this.ws.on('close', (code, reason) => this._handleClose(code, reason));
        this.ws.on('error', (error) => this._handleError(error));
        this.ws.on('ping', () => this.ws?.pong());
        this.ws.on('pong', () => this._handlePong());
    }
    _handleOpen() {
        clearTimeout(this.connectTimeout);
        this.connecting = false;
        this.connected = true;
        this.backoff.reset();
        this._emit('open');
    }
    _handleMessage(data) {
        this.messagesReceived++;
        this.lastPingTime = Date.now();
        try {
            const payload = this.messagePool.acquire();
            Object.assign(payload, JSON.parse(data.toString()));
            this._emit('raw', payload);
            // Handle by op code
            switch (payload.op) {
                case 'ready':
                    this._handleReady(payload);
                    break;
                case 'stats':
                    this._emit('stats', payload);
                    break;
                case 'playerUpdate':
                    this._emit('playerUpdate', String(payload.guildId), payload.state);
                    break;
                case 'event':
                    this._handleEvent(payload);
                    break;
                default:
                    this._emit('message', payload);
            }
            this.messagePool.release(payload);
        }
        catch (error) {
            this._emitError(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.WS_MESSAGE_ERROR, this.node.id, { reason: error instanceof Error ? error.message : 'Parse error' }));
        }
    }
    _handleReady(payload) {
        this.sessionId = payload.sessionId;
        // Start heartbeat
        this._startHeartbeat();
        // Emit ready event
        this._emit('ready', this.sessionId, payload.resumed ?? false);
        // Flush message queue
        this._flushMessageQueue();
    }
    _handleEvent(payload) {
        const guildId = payload.guildId;
        const type = payload.type;
        switch (type) {
            case 'TrackStartEvent':
                this._emit('trackStart', guildId, payload.track);
                break;
            case 'TrackEndEvent':
                this._emit('trackEnd', guildId, payload.track, payload.reason);
                break;
            case 'TrackExceptionEvent':
                this._emit('trackException', guildId, payload.track, payload.exception);
                break;
            case 'TrackStuckEvent':
                this._emit('trackStuck', guildId, payload.track, payload.thresholdMs);
                break;
            case 'WebSocketClosedEvent':
                this._emit('websocketClosed', guildId, payload.code, payload.reason, payload.byRemote);
                break;
        }
        this._emit('message', payload);
    }
    _handleClose(code, reason) {
        this.connected = false;
        this._stopHeartbeat();
        clearTimeout(this.connectTimeout);
        this._emit('close', code, reason.toString());
        // Check if this is a clean close
        if (code === 1000 || code === 1001) {
            return;
        }
        // Handle auth failure
        if (code === 4001) {
            this._emitError(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_AUTHENTICATION_FAILED, this.node.id, { code, reason: reason.toString() }));
            return;
        }
        this._handleReconnect(`WebSocket closed: ${code} - ${reason.toString()}`);
    }
    _handleError(error) {
        this._emitError(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.WS_CONNECTION_FAILED, this.node.id, { message: error.message }));
    }
    _handleReconnect(reason) {
        if (this.destroyed)
            return;
        const attempt = this.backoff.getAttempt();
        const maxRetries = this.node.maxRetryAttempts;
        if (attempt > 0 && attempt > maxRetries) {
            this._emitError(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_MAX_RETRIES_EXCEEDED, this.node.id, { reason, attempts: attempt }));
            return;
        }
        const delay = this.backoff.getDelay();
        this._emit('reconnecting', attempt);
        this.reconnectTimer = setTimeout(() => {
            this.connecting = false;
            this.connect(this.userId);
        }, delay);
    }
    _handlePong() {
        this.latency = Date.now() - this.lastPingTime;
        this.heartbeatAck = true;
    }
    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatAck = true;
        this.heartbeatInterval = setInterval(() => {
            if (!this.heartbeatAck) {
                // No pong received, connection is dead
                this.ws?.terminate();
                this._handleReconnect('Heartbeat timeout');
                return;
            }
            this.heartbeatAck = false;
            this.lastPingTime = Date.now();
            try {
                this.ws?.ping();
            }
            catch {
                this._handleReconnect('Failed to send heartbeat');
            }
        }, this.heartbeatTimer);
    }
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    _flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.connected) {
            const msg = this.messageQueue.shift();
            if (msg) {
                this.send(msg);
            }
        }
    }
    _cleanup() {
        this._stopHeartbeat();
        this.connected = false;
        this.connecting = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
        }
    }
    _emit(event, ...args) {
        const listeners = this.listeners.get(event);
        if (!listeners || listeners.size === 0)
            return;
        // Create snapshot to avoid mutation during emission
        const snapshot = Array.from(listeners);
        for (const listener of snapshot) {
            try {
                listener(...args);
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                this._emitError(err);
            }
        }
    }
    _emitError(error) {
        this._emit('error', errors_1.DavelinkError.fromPool(errors_1.ErrorCode.WS_MESSAGE_ERROR, this.node.id, { message: error.message }));
    }
}
exports.WebSocketClient = WebSocketClient;
// ============================================================================
// WebSocket Client Factory
// ============================================================================
function createWebSocketClient(options, userAgent) {
    return new WebSocketClient(options, userAgent);
}
//# sourceMappingURL=WebSocketClient.js.map