export declare enum ErrorCode {
    NODE_NOT_FOUND = "NODE_NOT_FOUND",
    NODE_CONNECTION_FAILED = "NODE_CONNECTION_FAILED",
    NODE_AUTHENTICATION_FAILED = "NODE_AUTHENTICATION_FAILED",
    NODE_DISCONNECTED = "NODE_DISCONNECTED",
    NODE_MAX_RETRIES_EXCEEDED = "NODE_MAX_RETRIES_EXCEEDED",
    NODE_ALREADY_EXISTS = "NODE_ALREADY_EXISTS",
    NODE_CIRCUIT_OPEN = "NODE_CIRCUIT_OPEN",
    WS_CONNECTION_FAILED = "WS_CONNECTION_FAILED",
    WS_NOT_OPEN = "WS_NOT_OPEN",
    WS_MESSAGE_ERROR = "WS_MESSAGE_ERROR",
    WS_TIMEOUT = "WS_TIMEOUT",
    WS_TERMINATE_ERROR = "WS_TERMINATE_ERROR",
    REST_REQUEST_FAILED = "REST_REQUEST_FAILED",
    REST_TIMEOUT = "REST_TIMEOUT",
    REST_RATE_LIMITED = "REST_RATE_LIMITED",
    REST_NOT_FOUND = "REST_NOT_FOUND",
    REST_CLIENT_DESTROYED = "REST_CLIENT_DESTROYED",
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
    PLAYER_ALREADY_EXISTS = "PLAYER_ALREADY_EXISTS",
    PLAYER_NOT_CONNECTED = "PLAYER_NOT_CONNECTED",
    PLAYER_VOICE_UPDATE_FAILED = "PLAYER_VOICE_UPDATE_FAILED",
    PLAYER_NO_LAVA_SESSION = "PLAYER_NO_LAVA_SESSION",
    PLAYER_DESTROYED = "PLAYER_DESTROYED",
    PLAYER_MIGRATION_FAILED = "PLAYER_MIGRATION_FAILED",
    TRACK_LOAD_FAILED = "TRACK_LOAD_FAILED",
    TRACK_NOT_FOUND = "TRACK_NOT_FOUND",
    TRACK_DECODE_FAILED = "TRACK_DECODE_FAILED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_OPTION = "INVALID_OPTION",
    MISSING_OPTION = "MISSING_OPTION",
    PLUGIN_ERROR = "PLUGIN_ERROR",
    PLUGIN_LOAD_FAILED = "PLUGIN_LOAD_FAILED",
    PLUGIN_INVALID = "PLUGIN_INVALID",
    QUEUE_FULL = "QUEUE_FULL",
    QUEUE_EMPTY = "QUEUE_EMPTY",
    DUPLICATE_TRACK = "DUPLICATE_TRACK",
    CIRCUIT_OPEN = "CIRCUIT_OPEN",
    CIRCUIT_HALF_OPEN = "CIRCUIT_HALF_OPEN",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export declare const ErrorMessages: Record<string, string>;
export declare class DavelinkError extends Error {
    code: ErrorCode;
    context: Record<string, unknown>;
    timestamp: number;
    recoverable: boolean;
    constructor(code: ErrorCode, context?: Record<string, unknown>, message?: string);
    reinitialize(code: ErrorCode, context?: Record<string, unknown>, message?: string): void;
    static fromPool(code: ErrorCode, context?: Record<string, unknown>, message?: string): DavelinkError;
    release(): void;
    static interpolate(template: string, vars: Record<string, unknown>): string;
    toJSON(): Record<string, unknown>;
}
export declare class NodeError extends DavelinkError {
    constructor(message: string, code?: ErrorCode, nodeId?: string, recoverable?: boolean);
}
export declare class PlayerError extends DavelinkError {
    constructor(message: string, code?: ErrorCode, guildId?: string, recoverable?: boolean);
}
export declare class TrackError extends DavelinkError {
    constructor(message: string, code?: ErrorCode, track?: string, recoverable?: boolean);
}
export declare class RESTError extends DavelinkError {
    statusCode?: number;
    endpoint?: string;
    method?: string;
    constructor(message: string, code?: ErrorCode, statusCode?: number, endpoint?: string, method?: string);
}
export declare class WebSocketError extends DavelinkError {
    constructor(message: string, code?: ErrorCode, nodeId?: string, recoverable?: boolean);
}
export declare class ValidationError extends DavelinkError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class PluginError extends DavelinkError {
    constructor(message: string, pluginName?: string);
}
export declare const ErrorCodes: typeof ErrorCode;
export declare function isRecoverableError(error: unknown): boolean;
export declare function fromRESTError(statusCode: number, body: Record<string, unknown>): DavelinkError;
export declare function fromWSCloseCode(code: number, reason: string): DavelinkError;
export declare function assert(condition: boolean, code: ErrorCode, message: string): asserts condition;
export declare function validateString(value: unknown, name: string, minLength?: number): void;
export declare function validateRange(value: number, name: string, min: number, max: number): void;
//# sourceMappingURL=index.d.ts.map