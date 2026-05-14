import type { NodeOptions, LavalinkInfo, LoadResult, UpdatePlayerOptions, Session, SessionConfig, FilterData } from "../types";
export declare class RESTClient {
    constructor(_node: NodeOptions, _userAgent?: string);
    destroy(): void;
    loadTracks(_identifier: string): Promise<LoadResult>;
    decodeTrack(_encodedTrack: string): Promise<LoadResult>;
    getInfo(): Promise<LavalinkInfo>;
    getStats(): Promise<{
        players: number;
        playingPlayers: number;
        uptime: number;
        memory: {
            free: number;
            used: number;
            allocated: number;
            reservable: number;
        };
        cpu: {
            cores: number;
            systemLoad: number;
            lavalinkLoad: number;
        };
        frameStats?: {
            sent: number;
            nulled: number;
            deficit: number;
        };
    }>;
    healthCheck(): Promise<boolean>;
    updatePlayer(_sessionId: string, _guildId: string, _options: UpdatePlayerOptions, _noReplace?: boolean): Promise<Record<string, unknown>>;
    destroyPlayer(_sessionId: string, _guildId: string): Promise<void>;
    setFilters(_sessionId: string, _guildId: string, _filters: FilterData): Promise<Record<string, unknown>>;
    seek(_sessionId: string, _guildId: string, _position: number): Promise<Record<string, unknown>>;
    updateSession(_sessionId: string, _config: SessionConfig): Promise<Session>;
}
//# sourceMappingURL=RESTClient.d.ts.map