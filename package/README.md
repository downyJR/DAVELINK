# dalink

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://npmjs.com/package/dalink)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

> The most stable, performant, and high-quality Lavalink v4 client library for Node.js. 
> Featuring a High-Level Player Manager, built-in Queue system, Session Resumption, Penalty-based Load Balancing, and zero bloat.

## Features

- **High-Level Player & Queue** — Intuitive `player.play()`, `player.skip()`, and built-in Queue system with auto-play functionality.
- **Full Lavalink v4 REST API** — Complete coverage of Lavalink v4 endpoints.
- **Robust WebSocket** — Heartbeat monitoring via ping/pong, exponential backoff reconnect, connection state guards.
- **Session Resumption** — Reconnect without losing player state using Lavalink's session resume protocol.
- **Penalty-Based Load Balancing** — Calculate node penalties from CPU, player count, and frame stats.
- **Client-Side Plugins** — Extensible architecture for building your own plugins.
- **TypeScript** — Full type definitions for all Lavalink v4 types, events, and API responses.
- **Minimal Dependencies** — Only `ws` for WebSocket support. REST uses Node.js built-in `http`/`https`.

## Installation

```bash
npm install dalink
```

## Quick Start

### 1. Initialize the Dalink Manager

```typescript
import { Dalink } from "dalink";

const manager = new Dalink({
  nodes: [
    {
      id: "main-node",
      hostname: "localhost",
      port: 2333,
      password: "youshallnotpass",
      secure: false,
      resumeTimeout: 60, // Enable session resumption
    }
  ],
  defaultSearchPlatform: "ytsearch",
});

manager.on("nodeReady", (node, resumed) => {
  console.log(`Connected to ${node.id}! Resumed: ${resumed}`);
});

manager.on("trackStart", (player, track) => {
  console.log(`Now playing in ${player.guildId}: ${track.info.title}`);
});

// Pass your Discord bot's user ID once logged in
manager.init("YOUR_BOT_USER_ID");
```

### 2. Loading and Playing Tracks

The new `Player` class and `Queue` system make playing music incredibly easy:

```typescript
// 1. Get or create a player for the guild
const player = manager.createPlayer("GUILD_ID");

// 2. Search for a track
const result = await manager.search("never gonna give you up");

if (result.loadType === "search" && Array.isArray(result.data)) {
  const track = result.data[0];

  // 3. Add to Queue
  player.queue.add(track);

  // 4. Play (if not already playing)
  if (!player.track) {
    await player.play();
  }
}
```

### 3. Player Control

```typescript
const player = manager.getPlayer("GUILD_ID");

await player.pause();
await player.resume();
await player.setVolume(80); // 0-1000
await player.seek(30000); // Seek to 30s
await player.skip(); // Skips current track and auto-plays the next in queue

// Stop and disconnect
await player.destroy();
```

### 4. Audio Filters

```typescript
// Apply filters
await player.setFilters({
  timescale: { speed: 1.2, pitch: 1.1, rate: 1.0 },
  equalizer: [
    { band: 0, gain: 0.5 },
    { band: 1, gain: 0.3 },
  ],
});

// Clear filters
await player.setFilters({});
```

### 5. Plugin System

Dalink v2 introduces client-side plugins:

```typescript
import { Dalink, Plugin } from "dalink";

class MyCustomPlugin implements Plugin {
  name = "MyPlugin";
  version = "1.0.0";

  load(manager: Dalink) {
    manager.on("trackStart", (player, track) => {
      console.log(`[Plugin] Track started: ${track.info.title}`);
    });
  }
}

const manager = new Dalink({
  nodes: [{ hostname: "localhost", port: 2333, password: "pass" }],
  plugins: [new MyCustomPlugin()]
});
```

## Architecture

Dalink v2 abstracts the complexities of Lavalink v4 into a clean architecture:

```
Dalink (Manager)
├── Nodes (WebSocket & REST clients for load balancing)
├── Players (Guild-specific playback sessions)
│   └── Queue (Track management & history)
└── Plugins (Client-side extensions)
```

## Lavalink Compatibility

This client targets **Lavalink v4**.
- [Lavalink GitHub](https://github.com/lavalink-devs/Lavalink)
- [Lavalink REST API](https://lavalink.dev/api/rest)

## License

MIT License — see [LICENSE](LICENSE) file.
