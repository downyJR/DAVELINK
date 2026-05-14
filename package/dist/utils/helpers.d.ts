/**
 * Fast deep clone for objects (faster than JSON.parse(JSON.stringify))
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Fast object merge (shallow)
 */
export declare function merge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T;
/**
 * Format milliseconds to human-readable duration
 */
export declare function formatDuration(ms: number): string;
/**
 * Calculate penalties for node load balancing
 */
export declare function calculatePenalties(players: number, playerPenalty: number, cpuPenalty: number, cpuLoad: number, deficitFrames: number, nullFrames: number): number;
export declare function generateId(prefix?: string): string;
/**
 * Wait for a specified duration
 */
export declare function wait(ms: number): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map