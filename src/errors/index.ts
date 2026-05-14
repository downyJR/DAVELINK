// ============================================================================
// High-Performance Error System with Pooling
// Reusable error objects to reduce GC pressure
// ============================================================================

export enum ErrorCode {
  // Node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_CONNECTION_FAILED = 'NODE_CONNECTION_FAILED',
  NODE_AUTHENTICATION_FAILED = 'NODE_AUTHENTICATION_FAILED',
  NODE_DISCONNECTED = 'NODE_DISCONNECTED',
  NODE_MAX_RETRIES_EXCEEDED = 'NODE_MAX_RETRIES_EXCEEDED',

  // WebSocket errors
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  WS_MESSAGE_ERROR = 'WS_MESSAGE_ERROR',
  WS_TIMEOUT = 'WS_TIMEOUT',

  // REST errors
  REST_REQUEST_FAILED = 'REST_REQUEST_FAILED',
  REST_TIMEOUT = 'REST_TIMEOUT',
  REST_RATE_LIMITED = 'REST_RATE_LIMITED',
  REST_NOT_FOUND = 'REST_NOT_FOUND',

  // Player errors
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  PLAYER_NOT_CONNECTED = 'PLAYER_NOT_CONNECTED',
  PLAYER_VOICE_UPDATE_FAILED = 'PLAYER_VOICE_UPDATE_FAILED',

  // Track errors
  TRACK_LOAD_FAILED = 'TRACK_LOAD_FAILED',
  TRACK_NOT_FOUND = 'TRACK_NOT_FOUND',
  TRACK_DECODE_FAILED = 'TRACK_DECODE_FAILED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Plugin errors
  PLUGIN_ERROR = 'PLUGIN_ERROR',
}

// Error message templates for reuse
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NODE_NOT_FOUND]: 'Node not found: {nodeId}',
  [ErrorCode.NODE_CONNECTION_FAILED]: 'Failed to connect to node: {reason}',
  [ErrorCode.NODE_AUTHENTICATION_FAILED]: 'Authentication failed for node: {nodeId}',
  [ErrorCode.NODE_DISCONNECTED]: 'Node disconnected: {nodeId} - {reason}',
  [ErrorCode.NODE_MAX_RETRIES_EXCEEDED]: 'Max retries exceeded for node: {nodeId}',
  [ErrorCode.WS_CONNECTION_FAILED]: 'WebSocket connection failed: {reason}',
  [ErrorCode.WS_MESSAGE_ERROR]: 'WebSocket message error: {reason}',
  [ErrorCode.WS_TIMEOUT]: 'WebSocket timeout',
  [ErrorCode.REST_REQUEST_FAILED]: 'REST request failed: {reason}',
  [ErrorCode.REST_TIMEOUT]: 'REST request timeout',
  [ErrorCode.REST_RATE_LIMITED]: 'Rate limited, retry after {retryAfter}ms',
  [ErrorCode.REST_NOT_FOUND]: 'Resource not found: {path}',
  [ErrorCode.PLAYER_NOT_FOUND]: 'Player not found for guild: {guildId}',
  [ErrorCode.PLAYER_NOT_CONNECTED]: 'Player not connected to voice channel: {guildId}',
  [ErrorCode.PLAYER_VOICE_UPDATE_FAILED]: 'Voice update failed: {reason}',
  [ErrorCode.TRACK_LOAD_FAILED]: 'Failed to load track: {identifier}',
  [ErrorCode.TRACK_NOT_FOUND]: 'Track not found: {identifier}',
  [ErrorCode.TRACK_DECODE_FAILED]: 'Failed to decode track: {track}',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error: {reason}',
  [ErrorCode.PLUGIN_ERROR]: 'Plugin error: {reason}',
};

// Object pool for error instances
class ErrorPool {
  private pool: Map<ErrorCode, DavelinkError[]> = new Map();
  private readonly maxPoolSize = 10;

  get(code: ErrorCode, nodeId?: string, additionalData?: Record<string, unknown>): DavelinkError {
    const cached = this.pool.get(code)?.pop();

    if (cached) {
      cached.reinitialize(nodeId, additionalData);
      return cached;
    }

    return new DavelinkError(code, nodeId, additionalData);
  }

  release(error: DavelinkError): void {
    const code = error.code;

    if (!this.pool.has(code)) {
      this.pool.set(code, []);
    }

    const pool = this.pool.get(code)!;
    if (pool.length < this.maxPoolSize) {
      pool.push(error);
    }
  }
}

const globalErrorPool = new ErrorPool();

export class DavelinkError extends Error {
  readonly code: ErrorCode;
  nodeId?: string;
  timestamp: number;
  readonly recoverable: boolean;
  additionalData?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    nodeId?: string,
    additionalData?: Record<string, unknown>,
    message?: string
  ) {
    // Generate message from template if not provided
    const template = ERROR_MESSAGES[code];
    const interpolated = template.replace(/\{(\w+)\}/g, (_, key) => String(({ nodeId, ...additionalData })[key] ?? `{${key}}`));
    const finalMessage = message ?? interpolated;

    super(finalMessage);
    this.name = 'DavelinkError';
    this.code = code;
    this.nodeId = nodeId;
    this.timestamp = Date.now();
    this.additionalData = additionalData;

    // Determine if error is recoverable
    this.recoverable = [
      ErrorCode.NODE_DISCONNECTED,
      ErrorCode.WS_TIMEOUT,
      ErrorCode.REST_TIMEOUT,
      ErrorCode.REST_RATE_LIMITED,
      ErrorCode.WS_CONNECTION_FAILED,
    ].includes(this.code);

    // Capture stack trace, excluding constructor call
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Reinitialize error for reuse from pool
   */
  reinitialize(nodeId?: string, additionalData?: Record<string, unknown>): void {
    this.nodeId = nodeId;
    this.additionalData = additionalData;

    const template = ERROR_MESSAGES[this.code];
    this.message = template.replace(/\{(\w+)\}/g, (_, k) => String(({ nodeId, ...additionalData })[k] ?? `{${k}}`));
    this.stack = undefined;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get from pool for better performance
   */
  static fromPool(code: ErrorCode, nodeId?: string, additionalData?: Record<string, unknown>): DavelinkError {
    return globalErrorPool.get(code, nodeId, additionalData);
  }

  /**
   * Return to pool for reuse
   */
  release(): void {
    globalErrorPool.release(this);
  }

  /**
   * Interpolate template variables
   */
  private interpolate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
  }

  /**
   * Check if this error type is recoverable
   */
  private isRecoverable(): boolean {
    return [
      ErrorCode.NODE_DISCONNECTED,
      ErrorCode.WS_TIMEOUT,
      ErrorCode.REST_TIMEOUT,
      ErrorCode.REST_RATE_LIMITED,
      ErrorCode.WS_CONNECTION_FAILED,
    ].includes(this.code);
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      nodeId: this.nodeId,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      additionalData: this.additionalData,
      stack: this.stack,
    };
  }
}

// Type aliases for convenience
export const NodeError = DavelinkError;
export const PlayerError = DavelinkError;
export const TrackError = DavelinkError;
export const RESTError = DavelinkError;
export const WebSocketError = DavelinkError;
export const ValidationError = DavelinkError;
export const PluginError = DavelinkError;

export { ErrorCode as ErrorCodes };

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof DavelinkError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Create error from REST response
 */
export function fromRESTError(statusCode: number, body: Record<string, unknown>): DavelinkError {
  const codeMap: Record<number, ErrorCode> = {
    401: ErrorCode.NODE_AUTHENTICATION_FAILED,
    404: ErrorCode.REST_NOT_FOUND,
    429: ErrorCode.REST_RATE_LIMITED,
  };

  const code = codeMap[statusCode] ?? ErrorCode.REST_REQUEST_FAILED;
  const retryAfter = typeof body.retryAfter === 'number' ? body.retryAfter : undefined;

  return DavelinkError.fromPool(code, undefined, { statusCode, retryAfter, body });
}

/**
 * Create error from WebSocket close code
 */
export function fromWSCloseCode(code: number, reason: string): DavelinkError {
  switch (code) {
    case 1000:
      return DavelinkError.fromPool(ErrorCode.NODE_DISCONNECTED, undefined, { code, reason, intentional: true });
    case 4001:
      return DavelinkError.fromPool(ErrorCode.NODE_AUTHENTICATION_FAILED, undefined, { code, reason });
    case 4002:
    case 4003:
    case 4004:
    case 4005:
      return DavelinkError.fromPool(ErrorCode.WS_MESSAGE_ERROR, undefined, { code, reason });
    default:
      return DavelinkError.fromPool(ErrorCode.WS_CONNECTION_FAILED, undefined, { code, reason });
  }
}

/**
 * Assertion helper for validating inputs
 */
export function assert(condition: boolean, code: ErrorCode, message?: string): asserts condition {
  if (!condition) {
    throw DavelinkError.fromPool(code, undefined, { message });
  }
}

/**
 * Validate and throw on invalid input
 */
export function validateString(value: unknown, name: string, minLength = 1): void {
  if (typeof value !== 'string' || value.length < minLength) {
    throw DavelinkError.fromPool(
      ErrorCode.VALIDATION_ERROR,
      undefined,
      { name, value, minLength, message: `${name} must be a string with at least ${minLength} characters` }
    );
  }
}

/**
 * Validate numeric range
 */
export function validateRange(value: number, name: string, min: number, max: number): void {
  if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
    throw DavelinkError.fromPool(
      ErrorCode.VALIDATION_ERROR,
      undefined,
      { name, value, min, max, message: `${name} must be between ${min} and ${max}` }
    );
  }
}