import type { PlayerOptions, PlayOptions, VoiceUpdateOptions, Filters, EqualizerBand, Track } from '../types';
import { TypedEventEmitter } from '../core/EventEmitter';
import type { Node } from '../node/Node';
export declare class Player extends TypedEventEmitter {
    readonly guildId: string;
    readonly node: Node;
    private state;
    private voiceState;
    private destroyed;
    constructor(guildId: string, node: Node, options?: PlayerOptions);
    /**
     * Play a track or the next in queue
     */
    play(options?: PlayOptions): Promise<void>;
    /**
     * Pause playback
     */
    pause(): Promise<void>;
    /**
     * Resume playback
     */
    resume(): Promise<void>;
    /**
     * Stop playback and clear queue
     */
    stop(): Promise<void>;
    /**
     * Skip to next track
     */
    skip(): Promise<void>;
    /**
     * Seek to position in track
     */
    seek(position: number): Promise<void>;
    /**
     * Set volume (0-1000)
     */
    setVolume(volume: number): Promise<void>;
    /**
     * Add track to queue
     */
    queueAdd(track: Track | string, position?: 'front' | 'back'): void;
    /**
     * Remove track from queue
     */
    queueRemove(index: number): Track | undefined;
    /**
     * Clear queue
     */
    queueClear(): void;
    /**
     * Get queue
     */
    queueGet(): Track[];
    /**
     * Shuffle queue
     */
    queueShuffle(): void;
    /**
     * Join a voice channel
     */
    join(channelId: string): Promise<void>;
    /**
     * Leave voice channel
     */
    leave(): Promise<void>;
    /**
     * Update voice state
     */
    voiceUpdate(options: VoiceUpdateOptions): Promise<void>;
    /**
     * Set audio filters
     */
    setFilters(filters: Filters): Promise<void>;
    /**
     * Apply equalizer preset
     */
    setEqualizer(bands: EqualizerBand[]): Promise<void>;
    /**
     * Clear all filters
     */
    clearFilters(): Promise<void>;
    get currentTrack(): Track | null;
    get previousTrack(): Track | null;
    get position(): number;
    get paused(): boolean;
    get volume(): number;
    get channelId(): string | null;
    get queueLength(): number;
    get isPlaying(): boolean;
    get isPaused(): boolean;
    get isConnected(): boolean;
    /**
     * Destroy the player
     */
    destroy(): Promise<void>;
    /**
     * Update internal state from player update events
     */
    _updateFromPlayerUpdate(state: {
        volume?: number;
        position?: number;
        paused?: boolean;
    }): void;
    private _updatePlayerState;
    private _setupEventForwarding;
}
export declare class PlayerManager {
    private players;
    private nodes;
    constructor();
    /**
     * Register a node
     */
    registerNode(node: Node): void;
    /**
     * Unregister a node
     */
    unregisterNode(nodeId: string): void;
    /**
     * Get or create a player
     */
    getPlayer(guildId: string): Player | undefined;
    /**
     * Create a new player
     */
    createPlayer(guildId: string, nodeId?: string): Player;
    /**
     * Destroy a player
     */
    destroyPlayer(guildId: string): Promise<void>;
    /**
     * Get all players
     */
    getPlayers(): Player[];
    /**
     * Get player count
     */
    getPlayerCount(): number;
    /**
     * Select best node based on load
     */
    private _selectBestNode;
}
//# sourceMappingURL=Player.d.ts.map