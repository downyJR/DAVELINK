"use strict";
// ============================================================================
// Davelink - High-Performance Lavalink Client
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.RoutePlannerClient = exports.RESTClient = exports.createWebSocketClient = exports.WebSocketClient = exports.validateRange = exports.validateString = exports.assert = exports.fromWSCloseCode = exports.fromRESTError = exports.isRecoverableError = exports.ErrorCodes = exports.ErrorCode = exports.PluginError = exports.ValidationError = exports.WebSocketError = exports.RESTError = exports.TrackError = exports.PlayerError = exports.NodeError = exports.DavelinkError = exports.globalTrackCache = exports.TrackCache = exports.LRUCache = exports.TypedEventEmitter = exports.PlayerManager = exports.Player = exports.NodeManager = exports.Node = exports.Davelink = exports.DavelinkManager = void 0;
// Core exports
var Davelink_1 = require("./Davelink");
Object.defineProperty(exports, "DavelinkManager", { enumerable: true, get: function () { return Davelink_1.DavelinkManager; } });
Object.defineProperty(exports, "Davelink", { enumerable: true, get: function () { return Davelink_1.Davelink; } });
var Node_1 = require("./node/Node");
Object.defineProperty(exports, "Node", { enumerable: true, get: function () { return Node_1.Node; } });
Object.defineProperty(exports, "NodeManager", { enumerable: true, get: function () { return Node_1.NodeManager; } });
var Player_1 = require("./player/Player");
Object.defineProperty(exports, "Player", { enumerable: true, get: function () { return Player_1.Player; } });
Object.defineProperty(exports, "PlayerManager", { enumerable: true, get: function () { return Player_1.PlayerManager; } });
// Utilities
var EventEmitter_1 = require("./core/EventEmitter");
Object.defineProperty(exports, "TypedEventEmitter", { enumerable: true, get: function () { return EventEmitter_1.TypedEventEmitter; } });
var TrackCache_1 = require("./cache/TrackCache");
Object.defineProperty(exports, "LRUCache", { enumerable: true, get: function () { return TrackCache_1.LRUCache; } });
Object.defineProperty(exports, "TrackCache", { enumerable: true, get: function () { return TrackCache_1.TrackCache; } });
Object.defineProperty(exports, "globalTrackCache", { enumerable: true, get: function () { return TrackCache_1.globalTrackCache; } });
// Error system
var errors_1 = require("./errors");
Object.defineProperty(exports, "DavelinkError", { enumerable: true, get: function () { return errors_1.DavelinkError; } });
Object.defineProperty(exports, "NodeError", { enumerable: true, get: function () { return errors_1.NodeError; } });
Object.defineProperty(exports, "PlayerError", { enumerable: true, get: function () { return errors_1.PlayerError; } });
Object.defineProperty(exports, "TrackError", { enumerable: true, get: function () { return errors_1.TrackError; } });
Object.defineProperty(exports, "RESTError", { enumerable: true, get: function () { return errors_1.RESTError; } });
Object.defineProperty(exports, "WebSocketError", { enumerable: true, get: function () { return errors_1.WebSocketError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "PluginError", { enumerable: true, get: function () { return errors_1.PluginError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return errors_1.ErrorCodes; } });
Object.defineProperty(exports, "isRecoverableError", { enumerable: true, get: function () { return errors_1.isRecoverableError; } });
Object.defineProperty(exports, "fromRESTError", { enumerable: true, get: function () { return errors_1.fromRESTError; } });
Object.defineProperty(exports, "fromWSCloseCode", { enumerable: true, get: function () { return errors_1.fromWSCloseCode; } });
Object.defineProperty(exports, "assert", { enumerable: true, get: function () { return errors_1.assert; } });
Object.defineProperty(exports, "validateString", { enumerable: true, get: function () { return errors_1.validateString; } });
Object.defineProperty(exports, "validateRange", { enumerable: true, get: function () { return errors_1.validateRange; } });
// WebSocket and REST clients
var WebSocketClient_1 = require("./ws/WebSocketClient");
Object.defineProperty(exports, "WebSocketClient", { enumerable: true, get: function () { return WebSocketClient_1.WebSocketClient; } });
Object.defineProperty(exports, "createWebSocketClient", { enumerable: true, get: function () { return WebSocketClient_1.createWebSocketClient; } });
var RESTClient_1 = require("./rest/RESTClient");
Object.defineProperty(exports, "RESTClient", { enumerable: true, get: function () { return RESTClient_1.RESTClient; } });
Object.defineProperty(exports, "RoutePlannerClient", { enumerable: true, get: function () { return RESTClient_1.RoutePlannerClient; } });
// Version
exports.VERSION = '3.0.0';
//# sourceMappingURL=index.js.map