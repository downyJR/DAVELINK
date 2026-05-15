import type { NodeOptions } from '../types';
export declare class RESTClient {
    private node;
    private userAgent;
    private sessionId;
    private destroyed;
    private rateLimiter;
    constructor(node: NodeOptions, userAgent?: string);
    setSessionId(sessionId: string): void;
    request(method: string, path: string, body?: unknown): Promise<unknown>;
    destroy(): void;
}
//# sourceMappingURL=RESTClient.d.ts.map