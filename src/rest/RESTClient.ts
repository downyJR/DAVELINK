// ============================================================================
// High-Performance REST Client with Rate Limiting and Connection Pooling
// Optimized for minimal latency and memory efficiency
// ============================================================================

import type { NodeOptions, LoadTracksResult, NodeInfo, NodeStats, Track } from '../types';
import { DavelinkError, fromRESTError, ErrorCode } from '../errors';

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  bucketSize: number;
  retryDelay: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
  queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }>;
  processing: boolean;
}

class TokenBucketRateLimiter {
  private config: RateLimitConfig;
  private bucket: BucketState;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.bucket = {
      tokens: config.bucketSize,
      lastRefill: Date.now(),
      queue: [],
      processing: false,
    };
  }

  /**
   * Acquire a token for a request
   */
  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.bucket.queue.push({
        resolve,
        reject,
        timestamp: Date.now(),
      });

      if (!this.bucket.processing) {
        this._processQueue();
      }
    });
  }

  /**
   * Process the request queue
   */
  private _processQueue(): void {
    this.bucket.processing = true;

    const processNext = (): void => {
      // Refill tokens
      this._refill();

      if (this.bucket.tokens >= 1 && this.bucket.queue.length > 0) {
        this.bucket.tokens -= 1;
        const request = this.bucket.queue.shift()!;
        request.resolve();

        // Schedule next
        setImmediate(processNext);
      } else if (this.bucket.queue.length > 0) {
        // Wait before trying again
        setTimeout(processNext, 50);
      } else {
        this.bucket.processing = false;
      }
    };

    processNext();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private _refill(): void {
    const now = Date.now();
    const elapsed = now - this.bucket.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.config.maxRequestsPerSecond;

    this.bucket.tokens = Math.min(
      this.config.bucketSize,
      this.bucket.tokens + tokensToAdd
    );
    this.bucket.lastRefill = now;
  }

  /**
   * Get current bucket status
   */
  getStatus(): { tokens: number; queueLength: number } {
    this._refill();
    return {
      tokens: Math.floor(this.bucket.tokens),
      queueLength: this.bucket.queue.length,
    };
  }
}

// ============================================================================
// Connection Pool for HTTP Requests
// ============================================================================

interface Connection {
  inUse: boolean;
  lastUsed: number;
}

class ConnectionPool {
  private connections: Map<string, Connection[]> = new Map();
  private readonly maxConnectionsPerHost = 10;
  private readonly connectionTimeout = 30000;

  /**
   * Get available connection or create new
   */
  acquire(host: string): Connection | null {
    let pool = this.connections.get(host);

    if (!pool) {
      pool = [];
      this.connections.set(host, pool);
    }

    // Find available connection
    for (const conn of pool) {
      if (!conn.inUse && Date.now() - conn.lastUsed < this.connectionTimeout) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        return conn;
      }
    }

    // Create new connection if under limit
    if (pool.length < this.maxConnectionsPerHost) {
      const conn = { inUse: true, lastUsed: Date.now() };
      pool.push(conn);
      return conn;
    }

    return null;
  }

  /**
   * Release a connection back to the pool
   */
  release(host: string, connection: Connection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();
  }

  /**
   * Clean up stale connections
   */
  cleanup(): void {
    const now = Date.now();
    for (const [host, pool] of this.connections) {
      const active = pool.filter(c => !c.inUse && now - c.lastUsed < this.connectionTimeout);
      if (active.length === 0) {
        this.connections.delete(host);
      } else {
        this.connections.set(host, active);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): Record<string, { total: number; available: number }> {
    const stats: Record<string, { total: number; available: number }> = {};

    for (const [host, pool] of this.connections) {
      stats[host] = {
        total: pool.length,
        available: pool.filter(c => !c.inUse).length,
      };
    }

    return stats;
  }
}

// ============================================================================
// High-Performance REST Client
// ============================================================================

export class RESTClient {
  private readonly options: Required<NodeOptions>;
  private readonly baseURL: string;
  private readonly headers: Record<string, string>;
  private rateLimiter: TokenBucketRateLimiter;
  private connectionPool: ConnectionPool;
  private requestTimings: number[] = [];
  private readonly maxTimings = 100;
  private destroyed = false;

  constructor(options: NodeOptions, userAgent = 'Davelink/3.0.0') {
    this.options = {
      id: options.id ?? `node-${Date.now()}`,
      hostname: options.hostname,
      port: options.port,
      password: options.password ?? 'youshallnotpass',
      secure: options.secure ?? false,
      maxRetryAttempts: options.maxRetryAttempts ?? Infinity,
      retryDelay: options.retryDelay ?? 5000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      resumeEnabled: options.resumeEnabled ?? true,
      resumeTimeout: options.resumeTimeout ?? 60,
      requestTimeout: options.requestTimeout ?? 10000,
      userAgent,
    };

    this.baseURL = `${this.options.secure ? 'https' : 'http'}://${this.options.hostname}:${this.options.port}`;
    this.headers = {
      'Authorization': this.options.password,
      'User-Agent': this.options.userAgent,
      'Content-Type': 'application/json',
    };

    this.rateLimiter = new TokenBucketRateLimiter({
      maxRequestsPerSecond: 10,
      bucketSize: 20,
      retryDelay: 1000,
    });

    this.connectionPool = new ConnectionPool();
  }

  /**
   * Destroy the REST client
   */
  destroy(): void {
    this.destroyed = true;
    this.rateLimiter = null as unknown as TokenBucketRateLimiter;
    this.connectionPool = null as unknown as ConnectionPool;
  }

  /**
   * Load tracks by identifier or search query
   */
  async loadTracks(identifier: string): Promise<LoadTracksResult> {
    return this._request<LoadTracksResult>(
      `/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`,
      'GET'
    );
  }

  /**
   * Decode a single track
   */
  async decodeTrack(encodedTrack: string): Promise<Track> {
    return this._request<Track>(
      `/v4/decodetrack?encodedTrack=${encodeURIComponent(encodedTrack)}`,
      'GET'
    );
  }

  /**
   * Decode multiple tracks
   */
  async decodeTracks(encodedTracks: string[]): Promise<Track[]> {
    return this._request<Track[]>(
      '/v4/decodetracks',
      'POST',
      encodedTracks
    );
  }

  /**
   * Get node info
   */
  async getInfo(): Promise<NodeInfo> {
    return this._request<NodeInfo>('/v4/info', 'GET');
  }

  /**
   * Get node statistics
   */
  async getStats(): Promise<NodeStats> {
    return this._request<NodeStats>('/v4/stats', 'GET');
  }

  /**
   * Update a player
   */
  async updatePlayer(
    sessionId: string,
    guildId: string,
    options: Record<string, unknown>,
    noReplace = false
  ): Promise<void> {
    await this._request(
      `/v4/sessions/${sessionId}/players/${guildId}?noReplace=${noReplace}`,
      'PATCH',
      options
    );
  }

  /**
   * Destroy a player
   */
  async destroyPlayer(sessionId: string, guildId: string): Promise<void> {
    await this._request(
      `/v4/sessions/${sessionId}/players/${guildId}`,
      'DELETE'
    );
  }

  /**
   * Update session configuration
   */
  async updateSession(
    sessionId: string,
    config: { timeout?: number; resuming?: boolean }
  ): Promise<void> {
    await this._request(
      `/v4/sessions/${sessionId}`,
      'PATCH',
      config
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getInfo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    avgResponseTime: number;
    requestCount: number;
    rateLimitStatus: { tokens: number; queueLength: number };
    connectionPoolStats: Record<string, { total: number; available: number }>;
  } {
    const avgResponseTime = this.requestTimings.length > 0
      ? this.requestTimings.reduce((a, b) => a + b, 0) / this.requestTimings.length
      : 0;

    return {
      avgResponseTime,
      requestCount: this.requestTimings.length,
      rateLimitStatus: this.rateLimiter.getStatus(),
      connectionPoolStats: this.connectionPool.getStats(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async _request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: unknown
  ): Promise<T> {
    if (this.destroyed) {
      throw DavelinkError.fromPool(ErrorCode.NODE_DISCONNECTED, this.options.id);
    }

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    const startTime = Date.now();
    const url = `${this.baseURL}${path}`;

    try {
      const result = await this._executeRequest<T>(url, method, body);

      // Record timing
      const duration = Date.now() - startTime;
      this._recordTiming(duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordTiming(duration);
      throw error;
    }
  }

  private async _executeRequest<T>(
    url: string,
    method: string,
    body?: unknown,
    retries = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.requestTimeout);

      const options: RequestInit = {
        method,
        headers: this.headers,
        signal: controller.signal,
      };

      if (body !== undefined && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      fetch(url, options)
        .then(response => {
          clearTimeout(timeout);

          if (!response.ok) {
            return response.json().then(data => {
              throw fromRESTError(response.status, data);
            }).catch(err => {
              if (err instanceof DavelinkError) throw err;
              throw DavelinkError.fromPool(
                ErrorCode.REST_REQUEST_FAILED,
                this.options.id,
                { status: response.status, statusText: response.statusText }
              );
            });
          }

          // Handle empty responses
          if (response.status === 204) {
            resolve(undefined as unknown as T);
            return;
          }

          return response.json() as Promise<T>;
        })
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);

          if (error.name === 'AbortError') {
            reject(DavelinkError.fromPool(ErrorCode.REST_TIMEOUT, this.options.id));
          } else if (error instanceof DavelinkError) {
            reject(error);
          } else if (retries < this.options.maxRetryAttempts) {
            // Retry on recoverable errors
            const delay = this.options.retryDelay * Math.pow(2, retries);
            setTimeout(() => {
              this._executeRequest<T>(url, method, body, retries + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
          } else {
            reject(DavelinkError.fromPool(
              ErrorCode.REST_REQUEST_FAILED,
              this.options.id,
              { message: error.message }
            ));
          }
        });
    });
  }

  private _recordTiming(duration: number): void {
    this.requestTimings.push(duration);
    if (this.requestTimings.length > this.maxTimings) {
      this.requestTimings.shift();
    }
  }
}

// ============================================================================
// Route Planner Client
// ============================================================================

export class RoutePlannerClient {
  private restClient: RESTClient;

  constructor(restClient: RESTClient) {
    this.restClient = restClient;
  }

  /**
   * Get route planner status
   */
  async getStatus(): Promise<{ class: string; details: Record<string, unknown> }> {
    return this.restClient.getInfo() as unknown as Promise<{ class: string; details: Record<string, unknown> }>;
  }

  /**
   * Free an address from the route planner
   */
  async freeAddress(address: string): Promise<void> {
    // This would be a custom endpoint depending on Lavalink version
    throw new Error('Route planner free address not implemented in client');
  }
}