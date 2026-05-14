import type { NodeOptions } from '../types';
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
    errors: Array<{
        type: string;
        count: number;
    }>;
}
export declare class MemoryProfiler {
    private snapshots;
    /**
     * Take a memory snapshot
     */
    snapshot(): void;
    /**
     * Get memory delta between snapshots
     */
    getDelta(startIndex?: number, endIndex?: number): {
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
    /**
     * Get current memory usage
     */
    getCurrent(): {
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
    /**
     * Clear snapshots
     */
    clear(): void;
    /**
     * Get all snapshots
     */
    getSnapshots(): typeof this.snapshots;
}
export declare class LatencyBenchmark {
    private results;
    private startTime;
    private endTime;
    /**
     * Start the benchmark
     */
    start(): void;
    /**
     * Record a latency measurement
     */
    record(latency: number): void;
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
    };
    /**
     * Get results
     */
    getResults(): number[];
}
export declare class WebSocketBenchmark {
    private ws;
    private profiler;
    private results;
    constructor(nodeOptions: NodeOptions, userAgent?: string);
    /**
     * Benchmark message sending
     */
    benchmarkSendMessage(iterations?: number): Promise<BenchmarkResult>;
    /**
     * Benchmark message parsing
     */
    benchmarkParseMessage(iterations?: number): BenchmarkResult;
    /**
     * Benchmark connection handling
     */
    benchmarkConnection(iterations?: number): Promise<BenchmarkResult>;
    private _createResult;
}
export declare class CacheBenchmark {
    private trackCache;
    private lruCache;
    constructor();
    /**
     * Benchmark cache set operations
     */
    benchmarkSet(iterations?: number): BenchmarkResult;
    /**
     * Benchmark cache get operations
     */
    benchmarkGet(iterations?: number): BenchmarkResult;
    /**
     * Benchmark track cache
     */
    benchmarkTrackCache(iterations?: number): BenchmarkResult;
    /**
     * Benchmark cache hit rate
     */
    benchmarkHitRate(operations?: number, hitRatio?: number): BenchmarkResult;
    private _createResult;
}
export declare class EventLoopBenchmark {
    private profiler;
    constructor();
    /**
     * Benchmark event loop latency
     */
    benchmarkEventLoopLatency(iterations?: number): BenchmarkResult;
    /**
     * Benchmark setTimeout precision
     */
    benchmarkSetTimeoutPrecision(iterations?: number, delay?: number): BenchmarkResult;
}
export declare class RESTClientBenchmark {
    private rest;
    private profiler;
    constructor(nodeOptions: NodeOptions);
    /**
     * Benchmark REST health check
     */
    benchmarkHealthCheck(iterations?: number): Promise<BenchmarkResult>;
    /**
     * Benchmark track loading
     */
    benchmarkTrackLoading(iterations?: number): Promise<BenchmarkResult>;
}
export declare class StressTestRunner {
    private running;
    private operations;
    private successes;
    private failures;
    private latencies;
    private errors;
    private startTime;
    private endTime;
    /**
     * Run stress test
     */
    run(options: {
        duration: number;
        concurrency: number;
        operationFactory: () => Promise<number>;
        onProgress?: (progress: StressTestResult) => void;
    }): Promise<StressTestResult>;
    /**
     * Stop the stress test
     */
    stop(): void;
    private _worker;
    private _getCurrentResult;
}
export declare function runAllBenchmarks(nodeOptions?: NodeOptions): Promise<{
    cache: BenchmarkResult[];
    memory: BenchmarkResult[];
    eventLoop: BenchmarkResult[];
    rest?: BenchmarkResult[];
}>;
//# sourceMappingURL=benchmark.d.ts.map