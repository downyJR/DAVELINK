// ============================================================================
// High-Performance Benchmarking Suite for Davelink
// Memory profiling, latency testing, stress testing, and performance metrics
// ============================================================================

import { RESTClient } from '../rest/RESTClient';
import { WebSocketClient } from '../ws/WebSocketClient';
import { LRUCache, TrackCache } from '../cache/TrackCache';
import type { NodeOptions, Track } from '../types';

// ============================================================================
// Benchmark Results
// ============================================================================

export interface BenchmarkResult {
  name: string;
  iterations: number;
  duration: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
}

export interface StressTestResult {
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errors: Array<{ type: string; count: number }>;
}

// ============================================================================
// Memory Profiler
// ============================================================================

export class MemoryProfiler {
  private snapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  }> = [];

  /**
   * Take a memory snapshot
   */
  snapshot(): void {
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
  getDelta(startIndex = 0, endIndex?: number): {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  } {
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
  getCurrent(): { heapUsed: number; heapTotal: number; rss: number } {
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
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): typeof this.snapshots {
    return [...this.snapshots];
  }
}

// ============================================================================
// Latency Benchmark
// ============================================================================

export class LatencyBenchmark {
  private results: number[] = [];
  private startTime = 0;
  private endTime = 0;

  /**
   * Start the benchmark
   */
  start(): void {
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Record a latency measurement
   */
  record(latency: number): void {
    this.results.push(latency);
  }

  /**
   * End the benchmark
   */
  end(): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    totalDuration: number;
  } {
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
  getResults(): number[] {
    return [...this.results];
  }
}

// ============================================================================
// WebSocket Benchmark
// ============================================================================

export class WebSocketBenchmark {
  private ws: WebSocketClient;
  private profiler: MemoryProfiler;
  private results: BenchmarkResult[] = [];

  constructor(nodeOptions: NodeOptions, userAgent?: string) {
    this.ws = new WebSocketClient(nodeOptions, userAgent);
    this.profiler = new MemoryProfiler();
  }

  /**
   * Benchmark message sending
   */
  async benchmarkSendMessage(iterations = 10000): Promise<BenchmarkResult> {
    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

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
  benchmarkParseMessage(iterations = 100000): BenchmarkResult {
    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];
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
  async benchmarkConnection(iterations = 100): Promise<BenchmarkResult> {
    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const connStart = Date.now();

      const ws = new WebSocketClient({
        hostname: this.ws['node'].hostname,
        port: this.ws['node'].port,
      });

      await new Promise<void>((resolve) => {
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

  private _createResult(
    name: string,
    iterations: number,
    start: number,
    end: number,
    times: number[],
    profiler: MemoryProfiler
  ): BenchmarkResult {
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

// ============================================================================
// Cache Benchmark
// ============================================================================

export class CacheBenchmark {
  private trackCache: TrackCache;
  private lruCache: LRUCache<unknown>;

  constructor() {
    this.trackCache = new TrackCache({ maxTracks: 10000, trackTTL: 60000 });
    this.lruCache = new LRUCache({ maxSize: 10000, ttl: 60000 });
  }

  /**
   * Benchmark cache set operations
   */
  benchmarkSet(iterations = 100000): BenchmarkResult {
    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

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
  benchmarkGet(iterations = 100000): BenchmarkResult {
    // Pre-populate cache
    for (let i = 0; i < 10000; i++) {
      this.lruCache.set(`key-${i}`, { data: `value-${i}` });
    }

    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

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
  benchmarkTrackCache(iterations = 10000): BenchmarkResult {
    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

    const mockTrack: Track = {
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
  benchmarkHitRate(operations = 100000, hitRatio = 0.8): BenchmarkResult {
    // Pre-populate cache
    for (let i = 0; i < 10000; i++) {
      this.lruCache.set(`key-${i}`, { data: `value-${i}` });
    }

    const profiler = new MemoryProfiler();
    profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];
    let hits = 0;

    for (let i = 0; i < operations; i++) {
      const hitStart = Date.now();
      const useCache = Math.random() < hitRatio;
      const key = useCache ? `key-${i % 10000}` : `missing-${i}`;
      const result = this.lruCache.get(key);
      if (result) hits++;
      times.push(Date.now() - hitStart);
    }

    const end = Date.now();
    profiler.snapshot();

    const result = this._createResult('cacheHitRate', operations, start, end, times, profiler);
    (result as unknown as { hitRate: number }).hitRate = hits / operations;
    return result;
  }

  private _createResult(
    name: string,
    iterations: number,
    start: number,
    end: number,
    times: number[],
    profiler: MemoryProfiler
  ): BenchmarkResult {
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

// ============================================================================
// Event Loop Benchmark
// ============================================================================

export class EventLoopBenchmark {
  private profiler: MemoryProfiler;

  constructor() {
    this.profiler = new MemoryProfiler();
  }

  /**
   * Benchmark event loop latency
   */
  benchmarkEventLoopLatency(iterations = 1000): BenchmarkResult {
    this.profiler.snapshot();

    const start = Date.now();
    const latencies: number[] = [];

    let lastTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const currentTime = process.hrtime.bigint();
      const latency = Number(currentTime - lastTime) / 1_000_000;
      latencies.push(latency);
      lastTime = currentTime;

      // Yield to event loop
      setImmediate(() => {});
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
  benchmarkSetTimeoutPrecision(iterations = 1000, delay = 10): BenchmarkResult {
    this.profiler.snapshot();

    const start = Date.now();
    const errors: number[] = [];
    let completed = 0;

    return new Promise<BenchmarkResult>((resolve) => {
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
    }) as unknown as BenchmarkResult;
  }
}

// ============================================================================
// REST Client Benchmark
// ============================================================================

export class RESTClientBenchmark {
  private rest: RESTClient;
  private profiler: MemoryProfiler;

  constructor(nodeOptions: NodeOptions) {
    this.rest = new RESTClient(nodeOptions);
    this.profiler = new MemoryProfiler();
  }

  /**
   * Benchmark REST health check
   */
  async benchmarkHealthCheck(iterations = 1000): Promise<BenchmarkResult> {
    this.profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

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
  async benchmarkTrackLoading(iterations = 100): Promise<BenchmarkResult> {
    this.profiler.snapshot();

    const start = Date.now();
    const times: number[] = [];

    const testIdentifiers = [
      'ytsearch:test',
      'ytsearch:hello world',
      'scsearch:music',
    ];

    for (let i = 0; i < iterations; i++) {
      const loadStart = Date.now();
      try {
        await this.rest.loadTracks(testIdentifiers[i % testIdentifiers.length]);
      } catch {
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

// ============================================================================
// Stress Test Runner
// ============================================================================

export class StressTestRunner {
  private running = false;
  private operations = 0;
  private successes = 0;
  private failures = 0;
  private latencies: number[] = [];
  private errors: Map<string, number> = new Map();
  private startTime = 0;
  private endTime = 0;

  /**
   * Run stress test
   */
  async run(options: {
    duration: number;
    concurrency: number;
    operationFactory: () => Promise<number>;
    onProgress?: (progress: StressTestResult) => void;
  }): Promise<StressTestResult> {
    this.running = true;
    this.operations = 0;
    this.successes = 0;
    this.failures = 0;
    this.latencies = [];
    this.errors = new Map();
    this.startTime = Date.now();
    this.endTime = this.startTime + options.duration;

    const workers: Promise<void>[] = [];

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
  stop(): void {
    this.running = false;
  }

  private async _worker(options: {
    operationFactory: () => Promise<number>;
    concurrency: number;
  }): Promise<void> {
    while (this.running && Date.now() < this.endTime) {
      const opStart = Date.now();

      try {
        const latency = await options.operationFactory();
        this.operations++;
        this.successes++;
        this.latencies.push(latency);
      } catch (error) {
        this.operations++;
        this.failures++;
        const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
        this.errors.set(errorType, (this.errors.get(errorType) ?? 0) + 1);
      }
    }
  }

  private _getCurrentResult(): StressTestResult {
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

// ============================================================================
// Main Benchmark Runner
// ============================================================================

export async function runAllBenchmarks(nodeOptions?: NodeOptions): Promise<{
  cache: BenchmarkResult[];
  memory: BenchmarkResult[];
  eventLoop: BenchmarkResult[];
  rest?: BenchmarkResult[];
}> {
  console.log('Starting Davelink Benchmarks...\n');

  const results: {
    cache: BenchmarkResult[];
    memory: BenchmarkResult[];
    eventLoop: BenchmarkResult[];
    rest?: BenchmarkResult[];
  } = {
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
  const objects: unknown[] = [];
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
    } catch {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Run if executed directly
if (require.main === module) {
  runAllBenchmarks().catch(console.error);
}