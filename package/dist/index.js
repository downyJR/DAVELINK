"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.ErrorCode = exports.PluginError = exports.ValidationError = exports.WebSocketError = exports.RESTError = exports.TrackError = exports.PlayerError = exports.NodeError = exports.DALinkError = exports.Node = exports.WebSocketClient = void 0;
var WebSocketClient_1 = require("./ws/WebSocketClient");
Object.defineProperty(exports, "WebSocketClient", { enumerable: true, get: function () { return WebSocketClient_1.WebSocketClient; } });
var Node_1 = require("./node/Node");
Object.defineProperty(exports, "Node", { enumerable: true, get: function () { return Node_1.Node; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "DALinkError", { enumerable: true, get: function () { return errors_1.DALinkError; } });
Object.defineProperty(exports, "NodeError", { enumerable: true, get: function () { return errors_1.NodeError; } });
Object.defineProperty(exports, "PlayerError", { enumerable: true, get: function () { return errors_1.PlayerError; } });
Object.defineProperty(exports, "TrackError", { enumerable: true, get: function () { return errors_1.TrackError; } });
Object.defineProperty(exports, "RESTError", { enumerable: true, get: function () { return errors_1.RESTError; } });
Object.defineProperty(exports, "WebSocketError", { enumerable: true, get: function () { return errors_1.WebSocketError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "PluginError", { enumerable: true, get: function () { return errors_1.PluginError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
exports.VERSION = "1.0.0-fix";
//# sourceMappingURL=index.js.map