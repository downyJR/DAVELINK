"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginError = exports.ValidationError = exports.WebSocketError = exports.RESTError = exports.TrackError = exports.PlayerError = exports.NodeError = exports.DALinkError = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NODE_NOT_FOUND"] = "NODE_NOT_FOUND";
    ErrorCode["NODE_CONNECTION_FAILED"] = "NODE_CONNECTION_FAILED";
    ErrorCode["NODE_AUTHENTICATION_FAILED"] = "NODE_AUTHENTICATION_FAILED";
    ErrorCode["NODE_DISCONNECTED"] = "NODE_DISCONNECTED";
    ErrorCode["NODE_MAX_RETRIES_EXCEEDED"] = "NODE_MAX_RETRIES_EXCEEDED";
    ErrorCode["NODE_ALREADY_EXISTS"] = "NODE_ALREADY_EXISTS";
    ErrorCode["PLAYER_NOT_FOUND"] = "PLAYER_NOT_FOUND";
    ErrorCode["PLAYER_ALREADY_EXISTS"] = "PLAYER_ALREADY_EXISTS";
    ErrorCode["PLAYER_NO_VOICE_CHANNEL"] = "PLAYER_NO_VOICE_CHANNEL";
    ErrorCode["PLAYER_CONNECTION_LOST"] = "PLAYER_CONNECTION_LOST";
    ErrorCode["TRACK_LOAD_FAILED"] = "TRACK_LOAD_FAILED";
    ErrorCode["TRACK_NOT_FOUND"] = "TRACK_NOT_FOUND";
    ErrorCode["TRACK_INVALID"] = "TRACK_INVALID";
    ErrorCode["NO_MATCHES"] = "NO_MATCHES";
    ErrorCode["LOAD_FAILED"] = "LOAD_FAILED";
    ErrorCode["REST_REQUEST_FAILED"] = "REST_REQUEST_FAILED";
    ErrorCode["REST_TIMEOUT"] = "REST_TIMEOUT";
    ErrorCode["REST_RATE_LIMITED"] = "REST_RATE_LIMITED";
    ErrorCode["REST_INVALID_RESPONSE"] = "REST_INVALID_RESPONSE";
    ErrorCode["WS_CONNECTION_FAILED"] = "WS_CONNECTION_FAILED";
    ErrorCode["WS_NOT_OPEN"] = "WS_NOT_OPEN";
    ErrorCode["WS_MESSAGE_ERROR"] = "WS_MESSAGE_ERROR";
    ErrorCode["INVALID_OPTION"] = "INVALID_OPTION";
    ErrorCode["MISSING_OPTION"] = "MISSING_OPTION";
    ErrorCode["INVALID_GUILD_ID"] = "INVALID_GUILD_ID";
    ErrorCode["INVALID_VOICE_CHANNEL"] = "INVALID_VOICE_CHANNEL";
    ErrorCode["QUEUE_FULL"] = "QUEUE_FULL";
    ErrorCode["QUEUE_EMPTY"] = "QUEUE_EMPTY";
    ErrorCode["DUPLICATE_TRACK"] = "DUPLICATE_TRACK";
    ErrorCode["PLUGIN_LOAD_FAILED"] = "PLUGIN_LOAD_FAILED";
    ErrorCode["PLUGIN_INVALID"] = "PLUGIN_INVALID";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class DALinkError extends Error {
    code;
    context;
    timestamp;
    isRecoverable;
    constructor(message, code = ErrorCode.UNKNOWN_ERROR, context = {}, isRecoverable = false) {
        super(message);
        this.name = "DALinkError";
        this.code = code;
        this.context = context;
        this.timestamp = Date.now();
        this.isRecoverable = isRecoverable;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DALinkError);
        }
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp,
            isRecoverable: this.isRecoverable,
            stack: this.stack,
        };
    }
}
exports.DALinkError = DALinkError;
class NodeError extends DALinkError {
    constructor(message, code, nodeId, isRecoverable = true) {
        super(message, code, { nodeId }, isRecoverable);
        this.name = "NodeError";
    }
}
exports.NodeError = NodeError;
class PlayerError extends DALinkError {
    constructor(message, code, guildId, isRecoverable = true) {
        super(message, code, { guildId }, isRecoverable);
        this.name = "PlayerError";
    }
}
exports.PlayerError = PlayerError;
class TrackError extends DALinkError {
    constructor(message, code, track, isRecoverable = true) {
        super(message, code, { track }, isRecoverable);
        this.name = "TrackError";
    }
}
exports.TrackError = TrackError;
class RESTError extends DALinkError {
    statusCode;
    endpoint;
    method;
    constructor(message, code, statusCode, endpoint, method, isRecoverable = true) {
        super(message, code, { statusCode, endpoint, method }, isRecoverable);
        this.name = "RESTError";
        this.statusCode = statusCode;
        this.endpoint = endpoint;
        this.method = method;
    }
}
exports.RESTError = RESTError;
class WebSocketError extends DALinkError {
    constructor(message, code, nodeId, isRecoverable = true) {
        super(message, code, { nodeId }, isRecoverable);
        this.name = "WebSocketError";
    }
}
exports.WebSocketError = WebSocketError;
class ValidationError extends DALinkError {
    constructor(message, code = ErrorCode.INVALID_OPTION, context = {}) {
        super(message, code, context, false);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class PluginError extends DALinkError {
    constructor(message, code = ErrorCode.PLUGIN_LOAD_FAILED, pluginName) {
        super(message, code, { pluginName }, false);
        this.name = "PluginError";
    }
}
exports.PluginError = PluginError;
//# sourceMappingURL=DALinkError.js.map