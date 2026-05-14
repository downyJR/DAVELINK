"use strict";
// ============================================================================
// High-Performance REST Client with Rate Limiting and Connection Pooling
// Optimized for minimal latency and memory efficiency
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutePlannerClient = exports.RESTClient = void 0;
const errors_1 = require("../errors");
class TokenBucketRateLimiter {
    config;
    bucket;
    constructor(config) {
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
    async acquire() {
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
    _processQueue() {
        this.bucket.processing = true;
        const processNext = () => {
            // Refill tokens
            this._refill();
            if (this.bucket.tokens >= 1 && this.bucket.queue.length > 0) {
                this.bucket.tokens -= 1;
                const request = this.bucket.queue.shift();
                request.resolve();
                // Schedule next
                setImmediate(processNext);
            }
            else if (this.bucket.queue.length > 0) {
                // Wait before trying again
                setTimeout(processNext, 50);
            }
            else {
                this.bucket.processing = false;
            }
        };
        processNext();
    }
    /**
     * Refill tokens based on elapsed time
     */
    _refill() {
        const now = Date.now();
        const elapsed = now - this.bucket.lastRefill;
        const tokensToAdd = (elapsed / 1000) * this.config.maxRequestsPerSecond;
        this.bucket.tokens = Math.min(this.config.bucketSize, this.bucket.tokens + tokensToAdd);
        this.bucket.lastRefill = now;
    }
    /**
     * Get current bucket status
     */
    getStatus() {
        this._refill();
        return {
            tokens: Math.floor(this.bucket.tokens),
            queueLength: this.bucket.queue.length,
        };
    }
}
class ConnectionPool {
    connections = new Map();
    maxConnectionsPerHost = 10;
    connectionTimeout = 30000;
    /**
     * Get available connection or create new
     */
    acquire(host) {
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
    release(host, connection) {
        connection.inUse = false;
        connection.lastUsed = Date.now();
    }
    /**
     * Clean up stale connections
     */
    cleanup() {
        const now = Date.now();
        for (const [host, pool] of this.connections) {
            const active = pool.filter(c => !c.inUse && now - c.lastUsed < this.connectionTimeout);
            if (active.length === 0) {
                this.connections.delete(host);
            }
            else {
                this.connections.set(host, active);
            }
        }
    }
    /**
     * Get pool statistics
     */
    getStats() {
        const stats = {};
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
class RESTClient {
    options;
    baseURL;
    headers;
    rateLimiter;
    connectionPool;
    requestTimings = [];
    maxTimings = 100;
    destroyed = false;
    constructor(options, userAgent = 'Davelink/3.0.0') {
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
    destroy() {
        this.destroyed = true;
        this.rateLimiter = null;
        this.connectionPool = null;
    }
    /**
     * Load tracks by identifier or search query
     */
    async loadTracks(identifier) {
        return this._request(`/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`, 'GET');
    }
    /**
     * Decode a single track
     */
    async decodeTrack(encodedTrack) {
        return this._request(`/v4/decodetrack?encodedTrack=${encodeURIComponent(encodedTrack)}`, 'GET');
    }
    /**
     * Decode multiple tracks
     */
    async decodeTracks(encodedTracks) {
        return this._request('/v4/decodetracks', 'POST', encodedTracks);
    }
    /**
     * Get node info
     */
    async getInfo() {
        return this._request('/v4/info', 'GET');
    }
    /**
     * Get node statistics
     */
    async getStats() {
        return this._request('/v4/stats', 'GET');
    }
    /**
     * Update a player
     */
    async updatePlayer(sessionId, guildId, options, noReplace = false) {
        await this._request(`/v4/sessions/${sessionId}/players/${guildId}?noReplace=${noReplace}`, 'PATCH', options);
    }
    /**
     * Destroy a player
     */
    async destroyPlayer(sessionId, guildId) {
        await this._request(`/v4/sessions/${sessionId}/players/${guildId}`, 'DELETE');
    }
    /**
     * Update session configuration
     */
    async updateSession(sessionId, config) {
        await this._request(`/v4/sessions/${sessionId}`, 'PATCH', config);
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.getInfo();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get performance metrics
     */
    getMetrics() {
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
    async _request(path, method, body) {
        if (this.destroyed) {
            throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.NODE_DISCONNECTED, this.options.id);
        }
        // Acquire rate limit token
        await this.rateLimiter.acquire();
        const startTime = Date.now();
        const url = `${this.baseURL}${path}`;
        try {
            const result = await this._executeRequest(url, method, body);
            // Record timing
            const duration = Date.now() - startTime;
            this._recordTiming(duration);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this._recordTiming(duration);
            throw error;
        }
    }
    async _executeRequest(url, method, body, retries = 0) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.options.requestTimeout);
            const options = {
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
                        throw (0, errors_1.fromRESTError)(response.status, data);
                    }).catch(err => {
                        if (err instanceof errors_1.DavelinkError)
                            throw err;
                        throw errors_1.DavelinkError.fromPool(errors_1.ErrorCode.REST_REQUEST_FAILED, this.options.id, { status: response.status, statusText: response.statusText });
                    });
                }
                // Handle empty responses
                if (response.status === 204) {
                    resolve(undefined);
                    return;
                }
                return response.json();
            })
                .then(result => {
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timeout);
                if (error.name === 'AbortError') {
                    reject(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.REST_TIMEOUT, this.options.id));
                }
                else if (error instanceof errors_1.DavelinkError) {
                    reject(error);
                }
                else if (retries < this.options.maxRetryAttempts) {
                    // Retry on recoverable errors
                    const delay = this.options.retryDelay * Math.pow(2, retries);
                    setTimeout(() => {
                        this._executeRequest(url, method, body, retries + 1)
                            .then(resolve)
                            .catch(reject);
                    }, delay);
                }
                else {
                    reject(errors_1.DavelinkError.fromPool(errors_1.ErrorCode.REST_REQUEST_FAILED, this.options.id, { message: error.message }));
                }
            });
        });
    }
    _recordTiming(duration) {
        this.requestTimings.push(duration);
        if (this.requestTimings.length > this.maxTimings) {
            this.requestTimings.shift();
        }
    }
}
exports.RESTClient = RESTClient;
// ============================================================================
// Route Planner Client
// ============================================================================
class RoutePlannerClient {
    restClient;
    constructor(restClient) {
        this.restClient = restClient;
    }
    /**
     * Get route planner status
     */
    async getStatus() {
        return this.restClient.getInfo();
    }
    /**
     * Free an address from the route planner
     */
    async freeAddress(address) {
        // This would be a custom endpoint depending on Lavalink version
        throw new Error('Route planner free address not implemented in client');
    }
}
exports.RoutePlannerClient = RoutePlannerClient;
//# sourceMappingURL=RESTClient.js.map