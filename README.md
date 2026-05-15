# Davelink

High-performance Lavalink client for Node.js. TypeScript-first, memory-optimized, bulletproof audio streaming for Discord bots and music applications.

[![npm version](https://badge.fury.io/js/davelink.svg)](https://www.npmjs.com/package/davelink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## Features

- **TypeScript-first** - Full type definitions with zero-config setup
- **Memory-optimized** - Object pooling, LRU cache, voice state recycling
- **Bulletproof connections** - Exponential backoff, circuit breaker, auto-reconnect with resume
- **Multi-node load balancing** - Penalty-based, round-robin, random, weighted strategies
- **Complete Lavalink v4 support** - WebSocket events, REST API, filters, SponsorBlock, lyrics
- **Error recovery** - Structured error system with recoverable error detection
- **Health monitoring** - Per-node health checks with circuit breaker pattern
- **Plugin system** - Extensible architecture for custom functionality
- **Zero dependencies** - Only `ws` for WebSocket, uses native `fetch`

## Installation

```bash
npm install davelink ws
```

## Quick Start

```javascript
const { DavelinkManager } = require('davelink');

const manager = new DavelinkManager({
  nodes: [
    {
      id: 'node1',
      hostname: 'lavalink.example.com',
      port: 443,
      password: 'your-password',
      secure: true,
    }
  ]
});

manager.on('nodeReady', (node) => {
  console.log(`Connected to ${node.id}`);
});

manager.init('your-discord-bot-user-id');
manager.connect();
```

## Creating a Player

```javascript
// Create a player for a guild
const player = manager.createPlayer({
  guildId: '1234567890123456789',
  channelId: '9876543210987654321',  // Voice channel
  autoPlay: true,
  volume: 80,
});

// Search and play
const result = await manager.search('never gonna give you up');
if (result.loadType === 'search') {
  player.queueAdd(result.data[0]);
  await player.play({});
}
```

## Player Controls

```javascript
// Playback
await player.pause();
await player.resume();
await player.stop();
await player.skip();
await player.seek(30000); // 30 seconds

// Volume (0-1000)
await player.setVolume(150);

// Queue
player.queueAdd(track);
player.queueAdd(track, 'front'); // Add to front
player.queueRemove(0);
player.queueShuffle();
player.queueClear();

// Filters
await player.setFilters({
  equalizer: [
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.15 },
  ],
  timescale: { speed: 1.2, pitch: 1.0 },
});

await player.clearFilters();
```

## Load Balancing

```javascript
// Penalty-based (default) - routes to healthiest node
manager.setLoadBalancer('penalty');

// Round-robin - distributes evenly
manager.setLoadBalancer('roundrobin');

// Random
manager.setLoadBalancer('random');

// Weighted - custom node weights
manager.setLoadBalancer('weighted');
manager.setNodeWeight('node1', 200);
```

## Events

```javascript
manager.on('nodeReady', (node, resumed) => {
  console.log(`Node ${node.id} ready (resumed: ${resumed})`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Node ${node.id} error:`, error);
});

manager.on('nodeDisconnect', (node, code, reason) => {
  console.log(`Node ${node.id} disconnected: ${code} ${reason}`);
});

manager.on('trackStart', (player, track) => {
  console.log(`Playing: ${track.info.title}`);
});

manager.on('trackEnd', (player, track, reason) => {
  console.log(`Track ended: ${reason}`);
});

manager.on('queueEnd', (player) => {
  console.log('Queue finished');
});
```

## Node Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | string | hostname | Unique node identifier |
| `hostname` | string | required | Lavalink server hostname |
| `port` | number | required | Lavalink server port |
| `password` | string | "youshallnotpass" | Authentication password |
| `secure` | boolean | false | Use WSS/HTTPS |
| `retryDelay` | number | 5000 | Initial reconnect delay (ms) |
| `maxRetryAttempts` | number | Infinity | Max reconnection attempts |
| `maxReconnectDelay` | number | 30000 | Max reconnect delay (ms) |
| `resumeEnabled` | boolean | true | Enable session resuming |
| `resumeTimeout` | number | 60 | Resume timeout (seconds) |
| `requestTimeout` | number | 10000 | REST request timeout (ms) |
| `circuitThreshold` | number | 5 | Circuit breaker failure threshold |
| `circuitTimeout` | number | 30000 | Circuit breaker open timeout (ms) |

## Manager Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodes` | NodeOptions[] | required | Array of Lavalink nodes |
| `userAgent` | string | "Davelink/4.1.0" | User agent string |
| `loadBalancer` | string | "penalty" | Load balancing strategy |
| `debug` | boolean | false | Enable debug logging |
| `cache.maxSize` | number | 1000 | Max cached tracks |
| `cache.ttl` | number | 3600000 | Cache TTL (ms) |

## Player Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `guildId` | string | required | Discord guild ID |
| `channelId` | string | null | Voice channel ID |
| `autoPlay` | boolean | true | Auto-play next track |
| `volume` | number | 100 | Initial volume (0-1000) |

## Error Handling

```javascript
const { DavelinkError, ErrorCode, isRecoverableError } = require('davelink');

try {
  await manager.search('query');
} catch (error) {
  if (error instanceof DavelinkError) {
    console.log(`Error code: ${error.code}`);
    console.log(`Recoverable: ${error.recoverable}`);

    if (error.code === ErrorCode.REST_RATE_LIMITED) {
      console.log(`Retry after: ${error.context.retryAfter}ms`);
    }
  }
}

// Check if error is recoverable
if (isRecoverableError(error)) {
  console.log('This error can be retried');
}
```

## Plugins

```javascript
const myPlugin = {
  name: 'MyPlugin',
  version: '1.0.0',
  load(manager) {
    console.log('Plugin loaded!');
    // Access manager instance
  },
  unload() {
    console.log('Plugin unloaded!');
  }
};

manager.loadPlugin(myPlugin);
manager.unloadPlugin('MyPlugin');
```

## SponsorBlock

```javascript
player.enableSponsorBlock();
await player.setSponsorBlockCategories(['sponsor', 'intro', 'outro']);
const segments = player.getSponsorBlockSegments();
```

## Lyrics

```javascript
player.enableLyrics();
const lyrics = await player.fetchLyrics();
console.log(lyrics);
```

## Node Health Monitoring

```javascript
// Get node stats
const stats = manager.getNodeStats();
for (const node of stats) {
  console.log(`${node.id}: connected=${node.connected}, penalty=${node.penalty}`);
}

// Get circuit breaker state
const node = manager.getNode('node1');
console.log(node.getCircuitBreakerState()); // 'CLOSED', 'OPEN', or 'HALF_OPEN'

// Get detailed metrics
const metrics = manager.getMetrics();
console.log(metrics);
```

## TypeScript Support

```typescript
import { DavelinkManager, Player, Track, LoadResult } from 'davelink';

const manager = new DavelinkManager({ nodes: [...] });
const player: Player = manager.createPlayer({ guildId: '...' });
const result: LoadResult = await manager.search('query');
```

## Requirements

- Node.js 18.0.0 or higher
- Lavalink server v4.x

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the GitHub repository.

## Support

- GitHub Issues: https://github.com/downyJR/davelink/issues
- NPM Package: https://www.npmjs.com/package/davelink
