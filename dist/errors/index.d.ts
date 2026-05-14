export declare enum ErrorCode {
    NODE_NOT_FOUND = "NODE_NOT_FOUND",
    NODE_CONNECTION_FAILED = "NODE_CONNECTION_FAILED",
    NODE_AUTHENTICATION_FAILED = "NODE_AUTHENTICATION_FAILED",
    NODE_DISCONNECTED = "NODE_DISCONNECTED",
    NODE_MAX_RETRIES_EXCEEDED = "NODE_MAX_RETRIES_EXCEEDED",
    WS_CONNECTION_FAILED = "WS_CONNECTION_FAILED",
    WS_MESSAGE_ERROR = "WS_MESSAGE_ERROR",
    WS_TIMEOUT = "WS_TIMEOUT",
    REST_REQUEST_FAILED = "REST_REQUEST_FAILED",
    REST_TIMEOUT = "REST_TIMEOUT",
    REST_RATE_LIMITED = "REST_RATE_LIMITED",
    REST_NOT_FOUND = "REST_NOT_FOUND",
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
    PLAYER_NOT_CONNECTED = "PLAYER_NOT_CONNECTED",
    PLAYER_VOICE_UPDATE_FAILED = "PLAYER_VOICE_UPDATE_FAILED",
    TRACK_LOAD_FAILED = "TRACK_LOAD_FAILED",
    TRACK_NOT_FOUND = "TRACK_NOT_FOUND",
    TRACK_DECODE_FAILED = "TRACK_DECODE_FAILED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    PLUGIN_ERROR = "PLUGIN_ERROR"
}
export declare class DavelinkError extends Error {
    readonly code: ErrorCode;
    nodeId?: string;
    timestamp: number;
    readonly recoverable: boolean;
    additionalData?: Record<string, unknown>;
    constructor(code: ErrorCode, nodeId?: string, additionalData?: Record<string, unknown>, message?: string);
    /**
     * Reinitialize error for reuse from pool
     */
    reinitialize(nodeId?: string, additionalData?: Record<string, unknown>): void;
    /**
     * Get from pool for better performance
     */
    static fromPool(code: ErrorCode, nodeId?: string, additionalData?: Record<string, unknown>): DavelinkError;
    /**
     * Return to pool for reuse
     */
    release(): void;
    /**
     * Interpolate template variables
     */
    private interpolate;
    /**
     * Check if this error type is recoverable
     */
    private isRecoverable;
    /**
     * Convert to JSON for serialization
     */
    toJSON(): object;
}
export declare const NodeError: typeof DavelinkError;
export declare const PlayerError: typeof DavelinkError;
export declare const TrackError: typeof DavelinkError;
export declare const RESTError: typeof DavelinkError;
export declare const WebSocketError: typeof DavelinkError;
export declare const ValidationError: typeof DavelinkError;
export declare const PluginError: typeof DavelinkError;
export { ErrorCode as ErrorCodes };
/**
 * Check if error is recoverable
 */
export declare function isRecoverableError(error: unknown): boolean;
/**
 * Create error from REST response
 */
export declare function fromRESTError(statusCode: number, body: Record<string, unknown>): DavelinkError;
/**
 * Create error from WebSocket close code
 */
export declare function fromWSCloseCode(code: number, reason: string): DavelinkError;
/**
 * Assertion helper for validating inputs
 */
export declare function assert(condition: boolean, code: ErrorCode, message?: string): asserts condition;
/**
 * Validate and throw on invalid input
 */
export declare function validateString(value: unknown, name: string, minLength?: number): void;
/**
 * Validate numeric range
 */
export declare function validateRange(value: number, name: string, min: number, max: number): void;
//# sourceMappingURL=index.d.ts.map