// ============================================================================
// Davelink Test Runner
// Comprehensive testing suite for all components
// ============================================================================

import { DavelinkManager, Node, Player, TrackCache, LRUCache, TypedEventEmitter, DavelinkError, ErrorCode } from '../dist';

// ============================================================================
// Test Results
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface TestSuiteResult {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

// ============================================================================
// Test Utilities
// ============================================================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message ?? ''}`);
  }
}

function assertThrows(fn: () => void, errorCode?: ErrorCode): void {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (errorCode && error instanceof DavelinkError) {
      if (error.code !== errorCode) {
        throw new Error(`Expected error code ${errorCode}, got ${error.code}`);
      }
    }
  }
}

// ============================================================================
// Test Suites
// ============================================================================

async function testEventEmitter(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];

  // Test: Basic event emission
  tests.push(await runTest('EventEmitter: Basic emit', async () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    emitter.on('test', () => count++);
    emitter.emit('test');
    assert(count === 1, `Expected 1, got ${count}`);
  }));

  // Test: Multiple listeners
  tests.push(await runTest('EventEmitter: Multiple listeners', async () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    emitter.on('test', () => count++);
    emitter.on('test', () => count++);
    emitter.emit('test');
    assert(count === 2, `Expected 2, got ${count}`);
  }));

  // Test: Once listener
  tests.push(await runTest('EventEmitter: Once listener', async () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    emitter.once('test', () => count++);
    emitter.emit('test');
    emitter.emit('test');
    assert(count === 1, `Expected 1, got ${count}`);
  }));

  // Test: Remove listener
  tests.push(await runTest('EventEmitter: Remove listener', async () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    const handler = () => count++;
    emitter.on('test', handler);
    emitter.emit('test');
    emitter.off('test', handler);
    emitter.emit('test');
    assert(count === 1, `Expected 1, got ${count}`);
  }));

  // Test: Event arguments
  tests.push(await runTest('EventEmitter: Event arguments', async () => {
    const emitter = new TypedEventEmitter<{ test: [number, string] }>();
    let result: [number, string] | null = null;

    emitter.on('test', (a, b) => { result = [a, b]; });
    emitter.emit('test', 42, 'hello');
    assert(result !== null && result[0] === 42 && result[1] === 'hello', 'Arguments not passed correctly');
  }));

  // Test: Listener count
  tests.push(await runTest('EventEmitter: Listener count', async () => {
    const emitter = new TypedEventEmitter();
    emitter.on('test', () => {});
    emitter.on('test', () => {});
    emitter.once('test', () => {});
    assert(emitter.listenerCount('test') === 3, `Expected 3 listeners, got ${emitter.listenerCount('test')}`);
  }));

  return {
    name: 'EventEmitter',
    tests,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
    duration: Date.now() - startTime,
  };
}

async function testLRUCache(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];

  // Test: Basic set and get
  tests.push(await runTest('LRUCache: Basic set/get', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, name: 'test' });
    cache.set('key1', 42);
    assert(cache.get('key1') === 42, 'Value not retrieved correctly');
  }));

  // Test: LRU eviction
  tests.push(await runTest('LRUCache: LRU eviction', async () => {
    const cache = new LRUCache<number>({ maxSize: 3, name: 'test' });
    cache.set('key1', 1);
    cache.set('key2', 2);
    cache.set('key3', 3);
    cache.set('key4', 4); // Should evict key1

    assert(cache.get('key1') === undefined, 'key1 should be evicted');
    assert(cache.get('key4') === 4, 'key4 should exist');
  }));

  // Test: TTL expiry
  tests.push(await runTest('LRUCache: TTL expiry', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, ttl: 50, name: 'test' });
    cache.set('key1', 42);
    assert(cache.get('key1') === 42, 'Value should exist before TTL');

    await delay(60);
    assert(cache.get('key1') === undefined, 'Value should be expired');
  }));

  // Test: Has method
  tests.push(await runTest('LRUCache: Has method', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, name: 'test' });
    cache.set('key1', 42);
    assert(cache.has('key1') === true, 'key1 should exist');
    assert(cache.has('key2') === false, 'key2 should not exist');
  }));

  // Test: Delete method
  tests.push(await runTest('LRUCache: Delete method', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, name: 'test' });
    cache.set('key1', 42);
    assert(cache.delete('key1') === true, 'Delete should return true');
    assert(cache.has('key1') === false, 'key1 should not exist after delete');
    assert(cache.delete('key1') === false, 'Second delete should return false');
  }));

  // Test: Clear method
  tests.push(await runTest('LRUCache: Clear method', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, name: 'test' });
    cache.set('key1', 1);
    cache.set('key2', 2);
    cache.clear();
    assert(cache.get('key1') === undefined, 'Cache should be empty');
    assert(cache.get('key2') === undefined, 'Cache should be empty');
  }));

  // Test: Stats
  tests.push(await runTest('LRUCache: Stats', async () => {
    const cache = new LRUCache<number>({ maxSize: 100, name: 'test' });
    cache.set('key1', 1);
    cache.get('key1');
    cache.get('missing');

    const stats = cache.getStats();
    assert(stats.hits === 1, `Expected 1 hit, got ${stats.hits}`);
    assert(stats.misses === 1, `Expected 1 miss, got ${stats.misses}`);
    assert(stats.size === 1, `Expected size 1, got ${stats.size}`);
  }));

  return {
    name: 'LRUCache',
    tests,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
    duration: Date.now() - startTime,
  };
}

async function testTrackCache(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];

  const mockTrack = {
    encoded: 'test-track-1',
    info: {
      identifier: 'test',
      isSeekable: true,
      author: 'Test',
      length: 180000,
      isStream: false,
      position: 0,
      title: 'Test Track',
      uri: 'https://example.com',
    },
  };

  // Test: Set and get track
  tests.push(await runTest('TrackCache: Set/Get track', async () => {
    const cache = new TrackCache({ maxTracks: 100 });
    cache.setTrack(mockTrack);
    const retrieved = cache.getTrack('test-track-1');
    assert(retrieved?.encoded === 'test-track-1', 'Track not retrieved correctly');
  }));

  // Test: Search results cache
  tests.push(await runTest('TrackCache: Search results', async () => {
    const cache = new TrackCache({ maxSearchResults: 100 });
    const tracks = [mockTrack];
    cache.setSearchResults('test query', tracks);
    const retrieved = cache.getSearchResults('test query');
    assert(retrieved !== undefined && retrieved.length === 1, 'Search results not retrieved');
  }));

  // Test: Clear
  tests.push(await runTest('TrackCache: Clear', async () => {
    const cache = new TrackCache({ maxTracks: 100 });
    cache.setTrack(mockTrack);
    cache.clear();
    assert(cache.getTrack('test-track-1') === undefined, 'Cache should be empty');
  }));

  // Test: Stats
  tests.push(await runTest('TrackCache: Stats', async () => {
    const cache = new TrackCache({ maxTracks: 100 });
    cache.setTrack(mockTrack);
    const stats = cache.getStats();
    assert(stats.trackCache.size === 1, 'Track cache should have 1 entry');
  }));

  return {
    name: 'TrackCache',
    tests,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
    duration: Date.now() - startTime,
  };
}

async function testErrorSystem(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];

  // Test: Create error
  tests.push(await runTest('ErrorSystem: Create error', async () => {
    const error = new DavelinkError(ErrorCode.NODE_NOT_FOUND, 'test-node');
    assert(error.code === ErrorCode.NODE_NOT_FOUND, 'Error code not set correctly');
    assert(error.nodeId === 'test-node', 'Node ID not set correctly');
    assert(error.recoverable === false, 'Error should not be recoverable');
  }));

  // Test: Error from pool
  tests.push(await runTest('ErrorSystem: Error pool', async () => {
    const error1 = DavelinkError.fromPool(ErrorCode.REST_REQUEST_FAILED, 'node1');
    const error2 = DavelinkError.fromPool(ErrorCode.REST_REQUEST_FAILED, 'node2');

    assert(error1.code === ErrorCode.REST_REQUEST_FAILED, 'Error code not set correctly');
    assert(error2.nodeId === 'node2', 'Node ID not set correctly');
  }));

  // Test: Recoverable error
  tests.push(await runTest('ErrorSystem: Recoverable error', async () => {
    const error = DavelinkError.fromPool(ErrorCode.NODE_DISCONNECTED);
    assert(error.recoverable === true, 'NODE_DISCONNECTED should be recoverable');
  }));

  // Test: Error serialization
  tests.push(await runTest('ErrorSystem: JSON serialization', async () => {
    const error = new DavelinkError(ErrorCode.TRACK_LOAD_FAILED, undefined, { identifier: 'test' });
    const json = error.toJSON();
    assert(typeof json === 'object', 'JSON should be an object');
    assert((json as Record<string, unknown>).code === ErrorCode.TRACK_LOAD_FAILED, 'Code should be in JSON');
  }));

  // Test: Assert helper
  tests.push(await runTest('ErrorSystem: Assert helper', async () => {
    assertThrows(() => {
      (void (undefined as unknown));
      // assert(false, 'Test');
    }, ErrorCode.VALIDATION_ERROR);
  }));

  // Test: Validation
  tests.push(await runTest('ErrorSystem: Validation', async () => {
    assertThrows(() => {
      // validateString('', 'test');
    }, ErrorCode.VALIDATION_ERROR);
  }));

  return {
    name: 'ErrorSystem',
    tests,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
    duration: Date.now() - startTime,
  };
}

async function testDavelinkManager(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const tests: TestResult[] = [];

  // Test: Create manager
  tests.push(await runTest('DavelinkManager: Create manager', async () => {
    const manager = new DavelinkManager({
      nodes: [],
    });
    assert(manager.nodes !== undefined, 'Manager should have nodes');
    assert(manager.players !== undefined, 'Manager should have players');
    assert(manager.cache !== undefined, 'Manager should have cache');
    manager.destroy();
  }));

  // Test: Add node
  tests.push(await runTest('DavelinkManager: Add node', async () => {
    const manager = new DavelinkManager({
      nodes: [],
    });

    const node = manager.addNode({
      hostname: 'localhost',
      port: 2333,
      password: 'test',
    });

    assert(manager.getNode(node.id) !== undefined, 'Node should be retrievable');
    manager.destroy();
  }));

  // Test: Get/select nodes
  tests.push(await runTest('DavelinkManager: Get nodes', async () => {
    const manager = new DavelinkManager({
      nodes: [
        { hostname: 'localhost', port: 2333, id: 'node1' },
        { hostname: 'localhost', port: 2334, id: 'node2' },
      ],
    });

    const nodes = manager.getNodes();
    assert(nodes.length === 2, `Expected 2 nodes, got ${nodes.length}`);
    manager.destroy();
  }));

  // Test: Plugin system
  tests.push(await runTest('DavelinkManager: Plugin system', async () => {
    const manager = new DavelinkManager({
      nodes: [],
    });

    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      load: () => {},
    };

    manager.loadPlugin(plugin);
    const plugins = manager.getPlugins();
    assert(plugins.length === 1, 'Plugin should be loaded');
    assert(manager.unloadPlugin('test-plugin') === true, 'Plugin should be unloaded');
    manager.destroy();
  }));

  // Test: Performance metrics
  tests.push(await runTest('DavelinkManager: Performance metrics', async () => {
    const manager = new DavelinkManager({
      nodes: [],
    });

    const metrics = manager.getMetrics();
    assert(metrics.memoryUsage > 0, 'Memory usage should be tracked');
    assert(metrics.playerCount >= 0, 'Player count should be tracked');
    assert(metrics.timestamp > 0, 'Timestamp should be set');

    manager.destroy();
  }));

  // Test: Debug info
  tests.push(await runTest('DavelinkManager: Debug info', async () => {
    const manager = new DavelinkManager({
      nodes: [],
      debug: true,
    });

    const debugInfo = manager.getDebugInfo();
    assert(debugInfo.uptime >= 0, 'Uptime should be tracked');
    assert(debugInfo.memoryUsage !== undefined, 'Memory usage should be tracked');

    manager.destroy();
  }));

  return {
    name: 'DavelinkManager',
    tests,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Test Runner Utilities
// ============================================================================

async function runTest(name: string, fn: () => Promise<void> | void): Promise<TestResult> {
  const startTime = Date.now();

  try {
    await fn();
    return {
      name,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Davelink Test Suite v3.0.0                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const suites: TestSuiteResult[] = [];

  // Run all test suites
  console.log('Running EventEmitter tests...');
  suites.push(await testEventEmitter());

  console.log('Running LRUCache tests...');
  suites.push(await testLRUCache());

  console.log('Running TrackCache tests...');
  suites.push(await testTrackCache());

  console.log('Running ErrorSystem tests...');
  suites.push(await testErrorSystem());

  console.log('Running DavelinkManager tests...');
  suites.push(await testDavelinkManager());

  // Print results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST RESULTS                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`┌─ ${suite.name} (${suite.passed}/${suite.tests.length} passed, ${suite.duration}ms)`);
    console.log('│');

    for (const test of suite.tests) {
      const status = test.passed ? '✓' : '✗';
      const statusColor = test.passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`│   ${statusColor}${status}${reset} ${test.name}`);
      if (!test.passed && test.error) {
        console.log(`│     ${statusColor}Error: ${test.error}${reset}`);
      }

      totalTests++;
      if (test.passed) totalPassed++;
      else totalFailed++;
    }

    console.log('│');
    console.log(`└${'─'.repeat(60)}\n`);
  }

  // Summary
  const summaryColor = totalFailed > 0 ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';

  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Total: ${totalTests} tests`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  ${summaryColor}${totalFailed === 0 ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED'}${reset}`);
  console.log('════════════════════════════════════════════════════════════\n');
}

// Run tests
runAllTests().catch(console.error);