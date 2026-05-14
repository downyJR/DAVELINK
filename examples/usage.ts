// ============================================================================
// Davelink Usage Examples
// Comprehensive examples demonstrating all features
// ============================================================================

import { DavelinkManager, Plugin, Track } from '../dist';

// ============================================================================
// Example 1: Basic Setup
// ============================================================================

async function basicExample(): Promise<void> {
  // Create manager with multiple nodes
  const manager = new DavelinkManager({
    nodes: [
      {
        id: 'main-node',
        hostname: 'localhost',
        port: 2333,
        password: 'youshallnotpass',
        secure: false,
        resumeEnabled: true,
        resumeTimeout: 60,
      },
      {
        id: 'backup-node',
        hostname: 'localhost',
        port: 2334,
        password: 'youshallnotpass',
        secure: false,
      },
    ],
    defaultSearchPlatform: 'ytsearch',
    autoReconnect: true,
    loadBalancer: 'penalty', // Smart load balancing
    debug: true,
    cache: {
      enabled: true,
      maxSize: 10000,
      ttl: 3600000, // 1 hour
    },
  });

  // Event listeners
  manager.on('nodeReady', (node, resumed) => {
    console.log(`Node ${node.id} ready! (resumed: ${resumed})`);
  });

  manager.on('nodeDisconnect', (node, code, reason) => {
    console.log(`Node ${node.id} disconnected: ${code} - ${reason}`);
  });

  manager.on('nodeError', (node, error) => {
    console.error(`Node ${node.id} error:`, error.message);
  });

  manager.on('trackStart', (player, track) => {
    console.log(`Now playing: ${track.info.title} in guild ${player.guildId}`);
  });

  manager.on('trackEnd', (player, track, reason) => {
    console.log(`Track ended: ${track.info.title} (reason: ${reason})`);
  });

  manager.on('trackException', (player, track, error) => {
    console.error(`Track exception:`, error);
  });

  // Initialize with Discord user ID
  manager.init('123456789012345678');

  // Connect to all nodes
  manager.connect();
}

// ============================================================================
// Example 2: Playing Music
// ============================================================================

async function musicPlaybackExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  // Initialize
  manager.init('123456789012345678');

  // Get or create player for guild
  const player = manager.getPlayer('987654321098765432');

  // Join voice channel
  await player.join('voice-channel-id-123');

  // Send voice update (from Discord gateway)
  await player.voiceUpdate({
    guildId: '987654321098765432',
    sessionId: 'session-id-from-discord',
    token: 'voice-token',
    endpoint: 'voice.endpoint.com',
  });

  // Search for tracks
  const searchResult = await manager.search('never gonna give you up');

  if (searchResult.loadType === 'search' && searchResult.data) {
    const tracks = searchResult.data as Track[];

    // Add first track to queue
    player.queueAdd(tracks[0]);

    // Play the track
    await player.play({
      track: tracks[0],
      startTime: 0,
      volume: 100,
    });
  }
}

// ============================================================================
// Example 3: Queue Management
// ============================================================================

async function queueManagementExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  manager.init('123456789012345678');
  const player = manager.getPlayer('987654321098765432');

  // Search and add multiple tracks
  const query = await manager.search('top 10 songs 2024');

  if (query.loadType === 'search' && query.data) {
    const tracks = query.data as Track[];

    // Add all tracks to queue
    for (const track of tracks) {
      player.queueAdd(track);
    }

    console.log(`Queue length: ${player.queueLength}`);

    // Shuffle queue
    player.queueShuffle();
    console.log(`Queue shuffled: ${player.queueLength} tracks`);

    // Remove specific track
    const removed = player.queueRemove(2);
    console.log(`Removed: ${removed?.info.title}`);
  }
}

// ============================================================================
// Example 4: Audio Filters
// ============================================================================

async function audioFiltersExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  manager.init('123456789012345678');
  const player = manager.getPlayer('987654321098765432');

  // Set equalizer
  await player.setEqualizer([
    { band: 0, gain: 0.5 },   // Bass boost
    { band: 1, gain: 0.4 },
    { band: 2, gain: 0.3 },
  ]);

  // Set other filters
  await player.setFilters({
    volume: 1.2, // 120% volume
    karaoke: {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220,
      filterWidth: 100,
    },
    timescale: {
      speed: 1.0,
      pitch: 1.0,
      rate: 1.0,
    },
    tremolo: {
      frequency: 2,
      depth: 0.5,
    },
  });

  // Clear all filters
  await player.clearFilters();
}

// ============================================================================
// Example 5: Plugin System
// ============================================================================

interface LyricsPlugin extends Plugin {
  getLyrics(track: Track): Promise<string | null>;
}

const lyricsPlugin: LyricsPlugin = {
  name: 'lyrics',
  version: '1.0.0',

  load(manager) {
    console.log('Lyrics plugin loaded!');

    manager.on('trackStart', (player, track) => {
      console.log(`Now playing: ${track.info.title}`);
      // Could fetch and display lyrics here
    });
  },

  async getLyrics(track) {
    // In real implementation, fetch from lyrics API
    return null;
  },
};

async function pluginExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  // Load plugins
  manager.loadPlugin(lyricsPlugin);

  // Later, unload if needed
  // manager.unloadPlugin('lyrics');

  console.log('Loaded plugins:', manager.getPlugins().map(p => p.name));
}

// ============================================================================
// Example 6: Performance Monitoring
// ============================================================================

async function performanceMonitoringExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  // Get current metrics
  const metrics = manager.getMetrics();
  console.log('Current metrics:', {
    memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
    cpuUsage: `${metrics.cpuUsage.toFixed(2)}%`,
    playerCount: metrics.playerCount,
    avgResponseTime: `${metrics.avgResponseTime.toFixed(2)}ms`,
  });

  // Get cache statistics
  const cacheStats = manager.getCacheStats();
  console.log('Cache stats:', {
    trackCache: cacheStats.trackCache.size,
    hitRate: `${(cacheStats.trackCache.hitRate * 100).toFixed(1)}%`,
  });

  // Get node statistics
  const nodeStats = manager.getNodeStats();
  console.log('Node stats:', nodeStats);

  // Get debug info
  const debugInfo = manager.getDebugInfo();
  console.log('Debug info:', {
    uptime: `${(debugInfo.uptime / 1000).toFixed(0)}s`,
    nodes: debugInfo.nodes,
    players: debugInfo.players,
    memory: `${(debugInfo.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
  });

  // Get historical metrics
  const history = manager.getMetricsHistory();
  console.log('Metrics history length:', history.length);
}

// ============================================================================
// Example 7: Load Balancing
// ============================================================================

async function loadBalancingExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [
      { id: 'node1', hostname: 'localhost', port: 2333, password: 'pass' },
      { id: 'node2', hostname: 'localhost', port: 2334, password: 'pass' },
      { id: 'node3', hostname: 'localhost', port: 2335, password: 'pass' },
    ],
    loadBalancer: 'penalty', // Use penalty-based balancing
  });

  // Add more nodes dynamically
  const newNode = manager.addNode({
    hostname: 'backup-server.com',
    port: 2333,
    password: 'pass',
  });

  console.log('All nodes:', manager.getNodes().map(n => n.id));

  // Remove a node
  manager.removeNode('node2');

  // Check connected nodes
  const connected = manager.nodes.getConnectedNodes();
  console.log('Connected nodes:', connected.map(n => n.id));
}

// ============================================================================
// Example 8: Track Caching
// ============================================================================

async function trackCachingExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
    cache: {
      enabled: true,
      maxSize: 50000, // 50k tracks
      ttl: 7200000,   // 2 hours
    },
  });

  // Search for a track (will be cached)
  const result = await manager.search('popular song');

  // Check cache stats
  const stats = manager.getCacheStats();
  console.log('Track cache size:', stats.trackCache.size);
  console.log('Hit rate:', `${(stats.trackCache.hitRate * 100).toFixed(1)}%`);

  // Search again (should hit cache)
  const cached = await manager.search('popular song');
  console.log('From cache:', cached.data ? 'Yes' : 'No');

  // Manually decode a track
  const track = await manager.decodeTrack('encoded-track-string');
  console.log('Decoded track:', track.info.title);
}

// ============================================================================
// Example 9: Error Handling
// ============================================================================

async function errorHandlingExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'wrong-password', // This will cause auth error
    }],
  });

  manager.on('nodeError', (node, error) => {
    console.error(`Node ${node.id} error:`, {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
    });

    if (error.recoverable) {
      console.log('This error is recoverable, will retry...');
    }
  });

  manager.on('trackException', (player, track, error) => {
    console.log(`Track exception in ${player.guildId}:`);
    console.log('  Track:', track.info.title);
    console.log('  Error:', error.message);
    console.log('  Severity:', error.severity);
  });

  // Try to connect
  manager.init('123456789012345678');
  manager.connect();
}

// ============================================================================
// Example 10: Advanced Player Control
// ============================================================================

async function advancedPlayerControlExample(): Promise<void> {
  const manager = new DavelinkManager({
    nodes: [{
      hostname: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
    }],
  });

  manager.init('123456789012345678');
  const player = manager.getPlayer('987654321098765432');

  // Basic controls
  await player.pause();
  console.log('Is paused:', player.isPaused);

  await player.resume();
  console.log('Is playing:', player.isPlaying);

  // Seek
  await player.seek(30000); // 30 seconds
  console.log('Position:', player.position);

  // Volume control
  await player.setVolume(150); // 150%
  console.log('Volume:', player.volume);

  // Skip to next
  await player.skip();

  // Stop playback
  await player.stop();

  // Clear queue
  player.queueClear();

  // Leave voice channel
  await player.leave();

  // Destroy player
  await player.destroy();
}

// ============================================================================
// Run all examples
// ============================================================================

async function runExamples(): Promise<void> {
  console.log('Davelink Examples\n');

  try {
    await basicExample();
    console.log('Basic example completed!\n');

    // Uncomment to run more examples:
    // await musicPlaybackExample();
    // await queueManagementExample();
    // await audioFiltersExample();
    // await pluginExample();
    // await performanceMonitoringExample();
    // await loadBalancingExample();
    // await trackCachingExample();
    // await errorHandlingExample();
    // await advancedPlayerControlExample();
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Export for use
export {
  basicExample,
  musicPlaybackExample,
  queueManagementExample,
  audioFiltersExample,
  pluginExample,
  performanceMonitoringExample,
  loadBalancingExample,
  trackCachingExample,
  errorHandlingExample,
  advancedPlayerControlExample,
  runExamples,
};