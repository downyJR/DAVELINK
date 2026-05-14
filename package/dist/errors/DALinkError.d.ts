export declare enum ErrorCode {
    NODE_NOT_FOUND = "NODE_NOT_FOUND",
    NODE_CONNECTION_FAILED = "NODE_CONNECTION_FAILED",
    NODE_AUTHENTICATION_FAILED = "NODE_AUTHENTICATION_FAILED",
    NODE_DISCONNECTED = "NODE_DISCONNECTED",
    NODE_MAX_RETRIES_EXCEEDED = "NODE_MAX_RETRIES_EXCEEDED",
    NODE_ALREADY_EXISTS = "NODE_ALREADY_EXISTS",
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
    PLAYER_ALREADY_EXISTS = "PLAYER_ALREADY_EXISTS",
    PLAYER_NO_VOICE_CHANNEL = "PLAYER_NO_VOICE_CHANNEL",
    PLAYER_CONNECTION_LOST = "PLAYER_CONNECTION_LOST",
    TRACK_LOAD_FAILED = "TRACK_LOAD_FAILED",
    TRACK_NOT_FOUND = "TRACK_NOT_FOUND",
    TRACK_INVALID = "TRACK_INVALID",
    NO_MATCHES = "NO_MATCHES",
    LOAD_FAILED = "LOAD_FAILED",
    REST_REQUEST_FAILED = "REST_REQUEST_FAILED",
    REST_TIMEOUT = "REST_TIMEOUT",
    REST_RATE_LIMITED = "REST_RATE_LIMITED",
    REST_INVALID_RESPONSE = "REST_INVALID_RESPONSE",
    WS_CONNECTION_FAILED = "WS_CONNECTION_FAILED",
    WS_NOT_OPEN = "WS_NOT_OPEN",
    WS_MESSAGE_ERROR = "WS_MESSAGE_ERROR",
    INVALID_OPTION = "INVALID_OPTION",
    MISSING_OPTION = "MISSING_OPTION",
    INVALID_GUILD_ID = "INVALID_GUILD_ID",
    INVALID_VOICE_CHANNEL = "INVALID_VOICE_CHANNEL",
    QUEUE_FULL = "QUEUE_FULL",
    QUEUE_EMPTY = "QUEUE_EMPTY",
    DUPLICATE_TRACK = "DUPLICATE_TRACK",
    PLUGIN_LOAD_FAILED = "PLUGIN_LOAD_FAILED",
    PLUGIN_INVALID = "PLUGIN_INVALID",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export interface ErrorContext {
    nodeId?: string;
    guildId?: string;
    track?: string;
    [key: string]: unknown;
}
export declare class DALinkError extends Error {
    readonly code: ErrorCode;
    readonly context: ErrorContext;
    readonly timestamp: number;
    readonly isRecoverable: boolean;
    constructor(message: string, code?: ErrorCode, context?: ErrorContext, isRecoverable?: boolean);
    toJSON(): Record<string, unknown>;
}
export declare class NodeError extends DALinkError {
    constructor(message: string, code: ErrorCode, nodeId: string, isRecoverable?: boolean);
}
export declare class PlayerError extends DALinkError {
    constructor(message: string, code: ErrorCode, guildId: string, isRecoverable?: boolean);
}
export declare class TrackError extends DALinkError {
    constructor(message: string, code: ErrorCode, track?: string, isRecoverable?: boolean);
}
export declare class RESTError extends DALinkError {
    readonly statusCode?: number;
    readonly endpoint?: string;
    readonly method?: string;
    constructor(message: string, code: ErrorCode, statusCode?: number, endpoint?: string, method?: string, isRecoverable?: boolean);
}
export declare class WebSocketError extends DALinkError {
    constructor(message: string, code: ErrorCode, nodeId: string, isRecoverable?: boolean);
}
export declare class ValidationError extends DALinkError {
    constructor(message: string, code?: ErrorCode, context?: ErrorContext);
}
export declare class PluginError extends DALinkError {
    constructor(message: string, code?: ErrorCode, pluginName?: string);
}
//# sourceMappingURL=DALinkError.d.ts.map