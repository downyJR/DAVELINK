// ============================================================================
// Davelink - High-Performance Lavalink Client
// ============================================================================

// Core exports
export { DavelinkManager, Davelink } from './Davelink';
export { Node, NodeManager } from './node/Node';
export { Player, PlayerManager } from './player/Player';

// Utilities
export { TypedEventEmitter } from './core/EventEmitter';
export { LRUCache, TrackCache, globalTrackCache, CacheStats } from './cache/TrackCache';

// Error system
export {
  DavelinkError,
  NodeError,
  PlayerError,
  TrackError,
  RESTError,
  WebSocketError,
  ValidationError,
  PluginError,
  ErrorCode,
  ErrorCodes,
  isRecoverableError,
  fromRESTError,
  fromWSCloseCode,
  assert,
  validateString,
  validateRange,
} from './errors';

// WebSocket and REST clients
export { WebSocketClient, createWebSocketClient } from './ws/WebSocketClient';
export { RESTClient, RoutePlannerClient } from './rest/RESTClient';

// Types
export type {
  NodeOptions,
  ManagerOptions,
  CacheOptions,
  RateLimitOptions,
  LoadTracksResult,
  Track,
  TrackInfo,
  NodeInfo,
  NodeStats,
  PlayerOptions,
  PlayOptions,
  VoiceUpdateOptions,
  Filters,
  EqualizerBand,
  KaraokeFilter,
  TimescaleFilter,
  TremoloFilter,
  VibratoFilter,
  RotationFilter,
  DistortionFilter,
  ChannelMixFilter,
  LowPassFilter,
  PerformanceMetrics,
  Plugin,
  ManagerEvents,
  LavalinkEvent,
  TrackStartEvent,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,
} from './types';

// Version
export const VERSION = '3.0.0';