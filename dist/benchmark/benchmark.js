"use strict";
// ============================================================================
// High-Performance Benchmarking Suite for Davelink
// Memory profiling, latency testing, stress testing, and performance metrics
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.StressTestRunner = exports.RESTClientBenchmark = exports.EventLoopBenchmark = exports.CacheBenchmark = exports.WebSocketBenchmark = exports.LatencyBenchmark = exports.MemoryProfiler = void 0;
exports.runAllBenchmarks = runAllBenchmarks;
const RESTClient_1 = require("../rest/RESTClient");
const WebSocketClient_1 = require("../ws/WebSocketClient");
const TrackCache_1 = require("../cache/TrackCache");
// ============================================================================
// Memory Profiler
// ============================================================================
class MemoryProfiler {
    snapshots = [];
    /**
     * Take a memory snapshot
     */
    snapshot() {
        const usage = process.memoryUsage();
        this.snapshots.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss,
        });
    }
    /**
     * Get memory delta between snapshots
     */
    getDelta(startIndex = 0, endIndex) {
        const start = this.snapshots[startIndex];
        const end = endIndex !== undefined ? this.snapshots[endIndex] : this.snapshots[this.snapshots.length - 1];
        if (!start || !end) {
            return { heapUsed: 0, heapTotal: 0, rss: 0 };
        }
        return {
            heapUsed: end.heapUsed - start.heapUsed,
            heapTotal: end.heapTotal - start.heapTotal,
            rss: end.rss - start.rss,
        };
    }
    /**
     * Get current memory usage
     */
    getCurrent() {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
        };
    }
    /**
     * Clear snapshots
     */
    clear() {
        this.snapshots = [];
    }
    /**
     * Get all snapshots
     */
    getSnapshots() {
        return [...this.snapshots];
    }
}
exports.MemoryProfiler = MemoryProfiler;
// ============================================================================
// Latency Benchmark
// ============================================================================
class LatencyBenchmark {
    results = [];
    startTime = 0;
    endTime = 0;
    /**
     * Start the benchmark
     */
    start() {
        this.results = [];
        this.startTime = Date.now();
    }
    /**
     * Record a latency measurement
     */
    record(latency) {
        this.results.push(latency);
    }
    /**
     * End the benchmark
     */
    end() {
        this.endTime = Date.now();
        if (this.results.length === 0) {
            return {
                count: 0,
                avg: 0,
                min: 0,
                max: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                totalDuration: this.endTime - this.startTime,
            };
        }
        const sorted = [...this.results].sort((a, b) => a - b);
        const count = sorted.length;
        return {
            count,
            avg: sorted.reduce((a, b) => a + b, 0) / count,
            min: sorted[0],
            max: sorted[count - 1],
            p50: sorted[Math.floor(count * 0.5)],
            p95: sorted[Math.floor(count * 0.95)],
            p99: sorted[Math.floor(count * 0.99)],
            totalDuration: this.endTime - this.startTime,
        };
    }
    /**
     * Get results
     */
    getResults() {
        return [...this.results];
    }
}
exports.LatencyBenchmark = LatencyBenchmark;
// ============================================================================
// WebSocket Benchmark
// ============================================================================
class WebSocketBenchmark {
    ws;
    profiler;
    results = [];
    constructor(nodeOptions, userAgent) {
        this.ws = new WebSocketClient_1.WebSocketClient(nodeOptions, userAgent);
        this.profiler = new MemoryProfiler();
    }
    /**
     * Benchmark message sending
     */
    async benchmarkSendMessage(iterations = 10000) {
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const msgStart = Date.now();
            this.ws.send({ op: 'ping', timestamp: msgStart });
            times.push(Date.now() - msgStart);
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('sendMessage', iterations, start, end, times, profiler);
    }
    /**
     * Benchmark message parsing
     */
    benchmarkParseMessage(iterations = 100000) {
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        const testPayload = JSON.stringify({
            op: 'event',
            type: 'TrackEndEvent',
            guildId: '123456789',
            track: 'QAAAQICAJFlbCE9QTEVJVEVTVFMAQ29uZmx1ZW5jZQ',
            reason: 'FINISHED',
        });
        for (let i = 0; i < iterations; i++) {
            const msgStart = Date.now();
            JSON.parse(testPayload);
            times.push(Date.now() - msgStart);
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('parseMessage', iterations, start, end, times, profiler);
    }
    /**
     * Benchmark connection handling
     */
    async benchmarkConnection(iterations = 100) {
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const connStart = Date.now();
            const ws = new WebSocketClient_1.WebSocketClient({
                hostname: this.ws['node'].hostname,
                port: this.ws['node'].port,
            });
            await new Promise((resolve) => {
                ws.on('open', () => {
                    times.push(Date.now() - connStart);
                    ws.destroy();
                    resolve();
                });
                ws.on('error', () => {
                    // Ignore connection errors in benchmark
                    resolve();
                });
                ws.connect();
            });
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('connection', iterations, start, end, times, profiler);
    }
    _createResult(name, iterations, start, end, times, profiler) {
        const duration = end - start;
        const sorted = [...times].sort((a, b) => a - b);
        return {
            name,
            iterations,
            duration,
            avgTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            opsPerSecond: (iterations / duration) * 1000,
            memoryBefore: profiler.getSnapshots()[0]?.heapUsed ?? 0,
            memoryAfter: profiler.getSnapshots()[profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
            memoryDelta: profiler.getDelta().heapUsed,
        };
    }
}
exports.WebSocketBenchmark = WebSocketBenchmark;
// ============================================================================
// Cache Benchmark
// ============================================================================
class CacheBenchmark {
    trackCache;
    lruCache;
    constructor() {
        this.trackCache = new TrackCache_1.TrackCache({ maxTracks: 10000, trackTTL: 60000 });
        this.lruCache = new TrackCache_1.LRUCache({ maxSize: 10000, ttl: 60000 });
    }
    /**
     * Benchmark cache set operations
     */
    benchmarkSet(iterations = 100000) {
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const setStart = Date.now();
            this.lruCache.set(`key-${i}`, { data: `value-${i}`, timestamp: Date.now() });
            times.push(Date.now() - setStart);
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('cacheSet', iterations, start, end, times, profiler);
    }
    /**
     * Benchmark cache get operations
     */
    benchmarkGet(iterations = 100000) {
        // Pre-populate cache
        for (let i = 0; i < 10000; i++) {
            this.lruCache.set(`key-${i}`, { data: `value-${i}` });
        }
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const getStart = Date.now();
            this.lruCache.get(`key-${i % 10000}`);
            times.push(Date.now() - getStart);
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('cacheGet', iterations, start, end, times, profiler);
    }
    /**
     * Benchmark track cache
     */
    benchmarkTrackCache(iterations = 10000) {
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        const mockTrack = {
            encoded: '',
            info: {
                identifier: 'test',
                isSeekable: true,
                author: 'Test Author',
                length: 180000,
                isStream: false,
                position: 0,
                title: 'Test Track',
                uri: 'https://example.com/track',
            },
        };
        for (let i = 0; i < iterations; i++) {
            const trackStart = Date.now();
            const encoded = `track-${i}`;
            mockTrack.encoded = encoded;
            this.trackCache.setTrack(mockTrack);
            times.push(Date.now() - trackStart);
        }
        const end = Date.now();
        profiler.snapshot();
        return this._createResult('trackCache', iterations, start, end, times, profiler);
    }
    /**
     * Benchmark cache hit rate
     */
    benchmarkHitRate(operations = 100000, hitRatio = 0.8) {
        // Pre-populate cache
        for (let i = 0; i < 10000; i++) {
            this.lruCache.set(`key-${i}`, { data: `value-${i}` });
        }
        const profiler = new MemoryProfiler();
        profiler.snapshot();
        const start = Date.now();
        const times = [];
        let hits = 0;
        for (let i = 0; i < operations; i++) {
            const hitStart = Date.now();
            const useCache = Math.random() < hitRatio;
            const key = useCache ? `key-${i % 10000}` : `missing-${i}`;
            const result = this.lruCache.get(key);
            if (result)
                hits++;
            times.push(Date.now() - hitStart);
        }
        const end = Date.now();
        profiler.snapshot();
        const result = this._createResult('cacheHitRate', operations, start, end, times, profiler);
        result.hitRate = hits / operations;
        return result;
    }
    _createResult(name, iterations, start, end, times, profiler) {
        const duration = end - start;
        const sorted = [...times].sort((a, b) => a - b);
        return {
            name,
            iterations,
            duration,
            avgTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            opsPerSecond: (iterations / duration) * 1000,
            memoryBefore: profiler.getSnapshots()[0]?.heapUsed ?? 0,
            memoryAfter: profiler.getSnapshots()[profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
            memoryDelta: profiler.getDelta().heapUsed,
        };
    }
}
exports.CacheBenchmark = CacheBenchmark;
// ============================================================================
// Event Loop Benchmark
// ============================================================================
class EventLoopBenchmark {
    profiler;
    constructor() {
        this.profiler = new MemoryProfiler();
    }
    /**
     * Benchmark event loop latency
     */
    benchmarkEventLoopLatency(iterations = 1000) {
        this.profiler.snapshot();
        const start = Date.now();
        const latencies = [];
        let lastTime = process.hrtime.bigint();
        for (let i = 0; i < iterations; i++) {
            const currentTime = process.hrtime.bigint();
            const latency = Number(currentTime - lastTime) / 1_000_000;
            latencies.push(latency);
            lastTime = currentTime;
            // Yield to event loop
            setImmediate(() => { });
        }
        const end = Date.now();
        this.profiler.snapshot();
        const duration = end - start;
        const sorted = [...latencies].sort((a, b) => a - b);
        return {
            name: 'eventLoopLatency',
            iterations,
            duration,
            avgTime: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            opsPerSecond: (iterations / duration) * 1000,
            memoryBefore: this.profiler.getSnapshots()[0]?.heapUsed ?? 0,
            memoryAfter: this.profiler.getSnapshots()[this.profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
            memoryDelta: this.profiler.getDelta().heapUsed,
        };
    }
    /**
     * Benchmark setTimeout precision
     */
    benchmarkSetTimeoutPrecision(iterations = 1000, delay = 10) {
        this.profiler.snapshot();
        const start = Date.now();
        const errors = [];
        let completed = 0;
        return new Promise((resolve) => {
            for (let i = 0; i < iterations; i++) {
                setTimeout(() => {
                    const actualDelay = Date.now() - start - (completed * delay);
                    errors.push(Math.abs(actualDelay - delay));
                    completed++;
                    if (completed === iterations) {
                        const end = Date.now();
                        this.profiler.snapshot();
                        const sorted = [...errors].sort((a, b) => a - b);
                        const duration = end - start;
                        resolve({
                            name: 'setTimeoutPrecision',
                            iterations,
                            duration,
                            avgTime: errors.reduce((a, b) => a + b, 0) / errors.length,
                            minTime: sorted[0],
                            maxTime: sorted[sorted.length - 1],
                            opsPerSecond: (iterations / duration) * 1000,
                            memoryBefore: this.profiler.getSnapshots()[0]?.heapUsed ?? 0,
                            memoryAfter: this.profiler.getSnapshots()[this.profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
                            memoryDelta: this.profiler.getDelta().heapUsed,
                        });
                    }
                }, delay);
            }
        });
    }
}
exports.EventLoopBenchmark = EventLoopBenchmark;
// ============================================================================
// REST Client Benchmark
// ============================================================================
class RESTClientBenchmark {
    rest;
    profiler;
    constructor(nodeOptions) {
        this.rest = new RESTClient_1.RESTClient(nodeOptions);
        this.profiler = new MemoryProfiler();
    }
    /**
     * Benchmark REST health check
     */
    async benchmarkHealthCheck(iterations = 1000) {
        this.profiler.snapshot();
        const start = Date.now();
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const healthStart = Date.now();
            await this.rest.healthCheck();
            times.push(Date.now() - healthStart);
        }
        const end = Date.now();
        this.profiler.snapshot();
        const duration = end - start;
        const sorted = [...times].sort((a, b) => a - b);
        return {
            name: 'healthCheck',
            iterations,
            duration,
            avgTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            opsPerSecond: (iterations / duration) * 1000,
            memoryBefore: this.profiler.getSnapshots()[0]?.heapUsed ?? 0,
            memoryAfter: this.profiler.getSnapshots()[this.profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
            memoryDelta: this.profiler.getDelta().heapUsed,
        };
    }
    /**
     * Benchmark track loading
     */
    async benchmarkTrackLoading(iterations = 100) {
        this.profiler.snapshot();
        const start = Date.now();
        const times = [];
        const testIdentifiers = [
            'ytsearch:test',
            'ytsearch:hello world',
            'scsearch:music',
        ];
        for (let i = 0; i < iterations; i++) {
            const loadStart = Date.now();
            try {
                await this.rest.loadTracks(testIdentifiers[i % testIdentifiers.length]);
            }
            catch {
                // Ignore errors
            }
            times.push(Date.now() - loadStart);
        }
        const end = Date.now();
        this.profiler.snapshot();
        const duration = end - start;
        const sorted = [...times].sort((a, b) => a - b);
        return {
            name: 'trackLoading',
            iterations,
            duration,
            avgTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            opsPerSecond: (iterations / duration) * 1000,
            memoryBefore: this.profiler.getSnapshots()[0]?.heapUsed ?? 0,
            memoryAfter: this.profiler.getSnapshots()[this.profiler.getSnapshots().length - 1]?.heapUsed ?? 0,
            memoryDelta: this.profiler.getDelta().heapUsed,
        };
    }
}
exports.RESTClientBenchmark = RESTClientBenchmark;
// ============================================================================
// Stress Test Runner
// ============================================================================
class StressTestRunner {
    running = false;
    operations = 0;
    successes = 0;
    failures = 0;
    latencies = [];
    errors = new Map();
    startTime = 0;
    endTime = 0;
    /**
     * Run stress test
     */
    async run(options) {
        this.running = true;
        this.operations = 0;
        this.successes = 0;
        this.failures = 0;
        this.latencies = [];
        this.errors = new Map();
        this.startTime = Date.now();
        this.endTime = this.startTime + options.duration;
        const workers = [];
        for (let i = 0; i < options.concurrency; i++) {
            workers.push(this._worker(options));
        }
        // Progress reporting
        const progressInterval = setInterval(() => {
            if (this.running && options.onProgress) {
                options.onProgress(this._getCurrentResult());
            }
        }, 1000);
        // Wait for all workers
        await Promise.all(workers);
        clearInterval(progressInterval);
        this.running = false;
        this.endTime = Date.now();
        return this._getCurrentResult();
    }
    /**
     * Stop the stress test
     */
    stop() {
        this.running = false;
    }
    async _worker(options) {
        while (this.running && Date.now() < this.endTime) {
            const opStart = Date.now();
            try {
                const latency = await options.operationFactory();
                this.operations++;
                this.successes++;
                this.latencies.push(latency);
            }
            catch (error) {
                this.operations++;
                this.failures++;
                const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
                this.errors.set(errorType, (this.errors.get(errorType) ?? 0) + 1);
            }
        }
    }
    _getCurrentResult() {
        const sorted = [...this.latencies].sort((a, b) => a - b);
        const count = sorted.length;
        const duration = this.endTime - this.startTime;
        return {
            duration,
            totalOperations: this.operations,
            successfulOperations: this.successes,
            failedOperations: this.failures,
            avgLatency: count > 0 ? sorted.reduce((a, b) => a + b, 0) / count : 0,
            maxLatency: count > 0 ? sorted[count - 1] : 0,
            minLatency: count > 0 ? sorted[0] : 0,
            p50Latency: count > 0 ? sorted[Math.floor(count * 0.5)] : 0,
            p95Latency: count > 0 ? sorted[Math.floor(count * 0.95)] : 0,
            p99Latency: count > 0 ? sorted[Math.floor(count * 0.99)] : 0,
            throughput: (this.operations / duration) * 1000,
            errors: Array.from(this.errors.entries()).map(([type, count]) => ({ type, count })),
        };
    }
}
exports.StressTestRunner = StressTestRunner;
// ============================================================================
// Main Benchmark Runner
// ============================================================================
async function runAllBenchmarks(nodeOptions) {
    console.log('Starting Davelink Benchmarks...\n');
    const results = {
        cache: [],
        memory: [],
        eventLoop: [],
    };
    // Cache benchmarks
    console.log('Running Cache Benchmarks...');
    const cacheBenchmark = new CacheBenchmark();
    results.cache.push(cacheBenchmark.benchmarkSet(100000));
    results.cache.push(cacheBenchmark.benchmarkGet(100000));
    results.cache.push(cacheBenchmark.benchmarkTrackCache(10000));
    results.cache.push(cacheBenchmark.benchmarkHitRate(100000, 0.8));
    // Memory benchmarks
    console.log('Running Memory Benchmarks...');
    const memoryBenchmark = new MemoryProfiler();
    memoryBenchmark.snapshot();
    // Simulate memory usage
    const objects = [];
    for (let i = 0; i < 100000; i++) {
        objects.push({ id: i, data: `data-${i}` });
    }
    memoryBenchmark.snapshot();
    // Clear and measure
    objects.length = 0;
    memoryBenchmark.snapshot();
    // Event loop benchmarks
    console.log('Running Event Loop Benchmarks...');
    const eventLoopBenchmark = new EventLoopBenchmark();
    results.eventLoop.push(eventLoopBenchmark.benchmarkEventLoopLatency(1000));
    // REST benchmarks (if node options provided)
    if (nodeOptions) {
        console.log('Running REST Benchmarks...');
        const restBenchmark = new RESTClientBenchmark(nodeOptions);
        try {
            const healthResult = await restBenchmark.benchmarkHealthCheck(100);
            results.rest = [healthResult];
        }
        catch {
            console.log('REST benchmarks skipped (no server available)');
        }
    }
    // Print results
    console.log('\n=== Benchmark Results ===\n');
    console.log('Cache Benchmarks:');
    for (const result of results.cache) {
        console.log(`  ${result.name}: ${result.opsPerSecond.toFixed(0)} ops/s, avg ${result.avgTime.toFixed(3)}ms`);
    }
    console.log('\nEvent Loop:');
    for (const result of results.eventLoop) {
        console.log(`  ${result.name}: avg ${result.avgTime.toFixed(3)}ms`);
    }
    console.log('\nMemory Delta:');
    const memStats = memoryBenchmark.getDelta();
    console.log(`  Heap Used: ${formatBytes(memStats.heapUsed)}`);
    console.log(`  RSS: ${formatBytes(memStats.rss)}`);
    return results;
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
// Run if executed directly
if (require.main === module) {
    runAllBenchmarks().catch(console.error);
}
//# sourceMappingURL=benchmark.js.map