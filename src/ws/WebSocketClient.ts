// ============================================================================
// High-Performance WebSocket Client with Memory Optimization
// Zero-copy parsing, minimal allocations, efficient reconnection
// ============================================================================

import WebSocket from 'ws';
import type { NodeOptions } from '../types';
import { DavelinkError, fromWSCloseCode, ErrorCode } from '../errors';

// ============================================================================
// Message Types for Pooling
// ============================================================================

interface MessageObject {
  op: string;
  [key: string]: unknown;
}

// Object pool for parsed messages
class MessagePool {
  private pool: MessageObject[] = [];
  private readonly maxPoolSize = 500;

  acquire(): MessageObject {
    return this.pool.pop() ?? { op: '' };
  }

  release(msg: MessageObject): void {
    if (this.pool.length < this.maxPoolSize) {
      // Clear all properties efficiently
      for (const key in msg) {
        delete (msg as Record<string, unknown>)[key];
      }
      msg.op = '';
      this.pool.push(msg);
    }
  }
}

// ============================================================================
// Backoff Strategy with Jitter
// ============================================================================

interface BackoffConfig {
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
  jitter: number;
}

class ExponentialBackoff {
  private attempt = 0;
  private config: BackoffConfig;

  constructor(config: Partial<BackoffConfig> = {}) {
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
  getDelay(): number {
    this.attempt++;
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.multiplier, this.attempt - 1);
    const jitter = Math.random() * this.config.jitter;
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }

  /**
   * Reset backoff state
   */
  reset(): void {
    this.attempt = 0;
  }

  /**
   * Get current attempt number
   */
  getAttempt(): number {
    return this.attempt;
  }
}

// ============================================================================
// Event Types
// ============================================================================

export type WebSocketEventType =
  | 'open'
  | 'close'
  | 'error'
  | 'message'
  | 'ready'
  | 'stats'
  | 'playerUpdate'
  | 'trackStart'
  | 'trackEnd'
  | 'trackException'
  | 'trackStuck'
  | 'websocketClosed'
  | 'raw'
  | 'reconnecting';

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

// ============================================================================
// High-Performance WebSocket Client
// ============================================================================

export class WebSocketClient {
  // Connection state
  private ws: WebSocket | null = null;
  private node: Required<NodeOptions>;
  private userId = '0';
  private resumeKey: string | null = null;

  // State flags
  private connected = false;
  private destroyed = false;
  private connecting = false;

  // Session management
  private sessionId: string | null = null;
  private resumeEnabled = true;

  // Timers (stored as numbers for quick comparison)
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatAck = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer = 30000; // 30 seconds

  // Message handling
  private messageQueue: unknown[] = [];
  private messagePool = new MessagePool();

  // Backoff strategy
  private backoff = new ExponentialBackoff({
    baseDelay: 1000,
    maxDelay: 30000,
    multiplier: 1.5,
    jitter: 500,
  });

  // Performance metrics
  private lastPingTime = 0;
  private latency = 0;
  private messagesReceived = 0;
  private messagesSent = 0;

  // Event listeners (optimized storage)
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  // User agent
  private readonly userAgent: string;

  constructor(node: NodeOptions, userAgent = 'Davelink/3.0.0') {
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
  connect(userId?: string): void {
    if (this.destroyed) {
      this._emitError(DavelinkError.fromPool(
        ErrorCode.WS_CONNECTION_FAILED,
        this.node.id,
        { reason: 'Client has been destroyed' }
      ));
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
    const headers: Record<string, string> = {
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
      this.ws = new WebSocket(url, {
        headers,
        handshakeTimeout: 10000,
        // Enable permessage-deflate compression
        perMessageDeflate: true,
      });

      this._setupEventHandlers();
    } catch (error) {
      clearTimeout(this.connectTimeout!);
      this.connecting = false;
      this._handleReconnect(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(code = 1000, reason = 'Client disconnecting'): void {
    if (this.destroyed) return;

    this._cleanup();
    this.ws?.close(code, reason);
  }

  /**
   * Destroy the WebSocket client
   */
  destroy(): void {
    this.destroyed = true;
    this._cleanup();

    if (this.ws) {
      // Check readyState before calling close
      if (this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.terminate();
      } else if (this.ws.readyState === WebSocket.OPEN) {
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
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Set the resume key for session resumption
   */
  setResumeKey(key: string): void {
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
  send(data: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(data);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      this.messagesSent++;
      return true;
    } catch (error) {
      this.messageQueue.push(data);
      return false;
    }
  }

  /**
   * Send voice update to the server
   */
  sendVoiceUpdate(guildId: string, sessionId: string, token: string, endpoint: string): boolean {
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
  sendPlayerUpdate(guildId: string, data: Record<string, unknown>): boolean {
    return this.send({
      op: 'playerUpdate',
      guildId,
      ...data,
    });
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

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
  } {
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
  on<K extends keyof WebSocketEvents>(
    event: K,
    listener: (...args: WebSocketEvents[K]) => void
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof WebSocketEvents>(
    event: K,
    listener: (...args: WebSocketEvents[K]) => void
  ): this {
    const onceListener = (...args: unknown[]) => {
      this.off(event, onceListener);
      (listener as (...args: unknown[]) => void)(...args);
    };
    return this.on(event, onceListener as (...args: WebSocketEvents[K]) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(
    event: K,
    listener: (...args: WebSocketEvents[K]) => void
  ): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (...args: unknown[]) => void);
    }
    return this;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => this._handleOpen());
    this.ws.on('message', (data) => this._handleMessage(data));
    this.ws.on('close', (code, reason) => this._handleClose(code, reason));
    this.ws.on('error', (error) => this._handleError(error));
    this.ws.on('ping', () => this.ws?.pong());
    this.ws.on('pong', () => this._handlePong());
  }

  private _handleOpen(): void {
    clearTimeout(this.connectTimeout!);
    this.connecting = false;
    this.connected = true;
    this.backoff.reset();
    this._emit('open');
  }

  private _handleMessage(data: WebSocket.Data): void {
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
          this._emit('playerUpdate', String(payload.guildId), payload.state as Record<string, unknown>);
          break;
        case 'event':
          this._handleEvent(payload);
          break;
        default:
          this._emit('message', payload);
      }

      this.messagePool.release(payload);
    } catch (error) {
      this._emitError(DavelinkError.fromPool(
        ErrorCode.WS_MESSAGE_ERROR,
        this.node.id,
        { reason: error instanceof Error ? error.message : 'Parse error' }
      ));
    }
  }

  private _handleReady(payload: Record<string, unknown>): void {
    this.sessionId = payload.sessionId as string;

    // Start heartbeat
    this._startHeartbeat();

    // Emit ready event
    this._emit('ready', this.sessionId, payload.resumed as boolean ?? false);

    // Flush message queue
    this._flushMessageQueue();
  }

  private _handleEvent(payload: Record<string, unknown>): void {
    const guildId = payload.guildId as string;
    const type = payload.type as string;

    switch (type) {
      case 'TrackStartEvent':
        this._emit('trackStart', guildId, payload.track as string);
        break;
      case 'TrackEndEvent':
        this._emit('trackEnd', guildId, payload.track as string, payload.reason as string);
        break;
      case 'TrackExceptionEvent':
        this._emit('trackException', guildId, payload.track as string, payload.exception as Record<string, unknown>);
        break;
      case 'TrackStuckEvent':
        this._emit('trackStuck', guildId, payload.track as string, payload.thresholdMs as number);
        break;
      case 'WebSocketClosedEvent':
        this._emit('websocketClosed', guildId, payload.code as number, payload.reason as string, payload.byRemote as boolean);
        break;
    }

    this._emit('message', payload);
  }

  private _handleClose(code: number, reason: Buffer): void {
    this.connected = false;
    this._stopHeartbeat();
    clearTimeout(this.connectTimeout!);

    this._emit('close', code, reason.toString());

    // Check if this is a clean close
    if (code === 1000 || code === 1001) {
      return;
    }

    // Handle auth failure
    if (code === 4001) {
      this._emitError(DavelinkError.fromPool(
        ErrorCode.NODE_AUTHENTICATION_FAILED,
        this.node.id,
        { code, reason: reason.toString() }
      ));
      return;
    }

    this._handleReconnect(`WebSocket closed: ${code} - ${reason.toString()}`);
  }

  private _handleError(error: Error): void {
    this._emitError(DavelinkError.fromPool(
      ErrorCode.WS_CONNECTION_FAILED,
      this.node.id,
      { message: error.message }
    ));
  }

  private _handleReconnect(reason: string): void {
    if (this.destroyed) return;

    const attempt = this.backoff.getAttempt();
    const maxRetries = this.node.maxRetryAttempts;

    if (attempt > 0 && attempt > maxRetries) {
      this._emitError(DavelinkError.fromPool(
        ErrorCode.NODE_MAX_RETRIES_EXCEEDED,
        this.node.id,
        { reason, attempts: attempt }
      ));
      return;
    }

    const delay = this.backoff.getDelay();

    this._emit('reconnecting', attempt);

    this.reconnectTimer = setTimeout(() => {
      this.connecting = false;
      this.connect(this.userId);
    }, delay);
  }

  private _handlePong(): void {
    this.latency = Date.now() - this.lastPingTime;
    this.heartbeatAck = true;
  }

  private _startHeartbeat(): void {
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
      } catch {
        this._handleReconnect('Failed to send heartbeat');
      }
    }, this.heartbeatTimer);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private _flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.connected) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg);
      }
    }
  }

  private _cleanup(): void {
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

  private _emit<K extends keyof WebSocketEvents>(event: K, ...args: WebSocketEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) return;

    // Create snapshot to avoid mutation during emission
    const snapshot = Array.from(listeners);
    for (const listener of snapshot) {
      try {
        listener(...args);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this._emitError(err);
      }
    }
  }

  private _emitError(error: Error): void {
    this._emit('error', DavelinkError.fromPool(
      ErrorCode.WS_MESSAGE_ERROR,
      this.node.id,
      { message: error.message }
    ));
  }
}

// ============================================================================
// WebSocket Client Factory
// ============================================================================

export function createWebSocketClient(
  options: NodeOptions,
  userAgent?: string
): WebSocketClient {
  return new WebSocketClient(options, userAgent);
}