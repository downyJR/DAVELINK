export interface NodeOptions {
    id?: string;
    hostname: string;
    port: number;
    password: string;
    secure?: boolean;
    regions?: string[];
    retryAmount?: number;
    retryDelay?: number;
    requestTimeout?: number;
    priority?: number;
    maxRetryAttempts?: number;
    resumeKey?: string;
    resumeTimeout?: number;
    maxFailures?: number;
    reconnectInterval?: number;
}
export interface NodeStats {
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
    penalties?: PenaltyData;
}
export interface PenaltyData {
    playerPenalty: number;
    cpuPenalty: number;
    deficitPenalty: number;
    nullPenalty: number;
    total: number;
}
export type LoadResultType = "track" | "playlist" | "search" | "empty" | "error";
export interface LoadResult {
    loadType: LoadResultType;
    data?: TrackData | PlaylistData | TrackData[] | ExceptionData;
}
export interface TrackData {
    encoded: string;
    info: TrackInfo;
    pluginInfo?: Record<string, unknown>;
    userData?: Record<string, unknown>;
}
export interface TrackInfo {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri?: string;
    artworkUrl?: string;
    isrc?: string;
    sourceName: string;
}
export interface PlaylistData {
    info: PlaylistInfo;
    tracks: TrackData[];
    pluginInfo?: Record<string, unknown>;
}
export interface PlaylistInfo {
    name: string;
    selectedTrack: number;
}
export interface ExceptionData {
    message: string;
    severity: string;
    cause: string;
}
export interface PlayerOptions {
    guildId: string;
    voiceChannelId: string;
    textChannelId?: string;
    volume?: number;
    selfDeafen?: boolean;
    selfMute?: boolean;
    node?: string;
    instaUpdateFiltersFix?: boolean;
}
export interface PlayerState {
    time: number;
    position: number;
    connected: boolean;
    ping: number;
    supress?: boolean;
}
export interface VoiceState {
    token: string;
    endpoint: string;
    sessionId: string;
}
export interface VoicePacket {
    t?: string;
    d: {
        guild_id: string;
        channel_id?: string | null;
        user_id?: string;
        session_id?: string;
        token?: string;
        endpoint?: string;
    };
}
export interface UpdatePlayerOptions {
    track?: {
        encoded?: string;
        identifier?: string;
        userData?: Record<string, unknown>;
    };
    position?: number;
    endTime?: number;
    volume?: number;
    paused?: boolean;
    filters?: FilterData;
    voice?: VoiceState;
}
export interface FilterData {
    volume?: number;
    equalizer?: EqualizerBand[];
    karaoke?: KaraokeFilter;
    timescale?: TimescaleFilter;
    tremolo?: TremoloFilter;
    vibrato?: VibratoFilter;
    rotation?: RotationFilter;
    distortion?: DistortionFilter;
    channelMix?: ChannelMixFilter;
    lowPass?: LowPassFilter;
}
export interface EqualizerBand {
    band: number;
    gain: number;
}
export interface KaraokeFilter {
    level?: number;
    monoLevel?: number;
    filterBand?: number;
    filterWidth?: number;
}
export interface TimescaleFilter {
    speed?: number;
    pitch?: number;
    rate?: number;
}
export interface TremoloFilter {
    frequency?: number;
    depth?: number;
}
export interface VibratoFilter {
    frequency?: number;
    depth?: number;
}
export interface RotationFilter {
    rotationHz?: number;
}
export interface DistortionFilter {
    sinOffset?: number;
    sinScale?: number;
    cosOffset?: number;
    cosScale?: number;
    tanOffset?: number;
    tanScale?: number;
    offset?: number;
    scale?: number;
}
export interface ChannelMixFilter {
    leftToLeft?: number;
    leftToRight?: number;
    rightToLeft?: number;
    rightToRight?: number;
}
export interface LowPassFilter {
    smoothing?: number;
}
export type FilterPresetName = "bassboost" | "bassboostLow" | "bassboostHigh" | "classical" | "dance" | "eightD" | "electronic" | "equalizer" | "guitar" | "jazz" | "pop" | "nightcore" | "superfast" | "partynight" | "phonk" | "piano" | "rabbit" | "slowreverb" | "soft" | "treblebass" | "vaporewave" | "vibrato";
export interface ReadyEvent {
    op: "ready";
    resumed: boolean;
    sessionId: string;
}
export interface PlayerUpdateEvent {
    op: "playerUpdate";
    guildId: string;
    state: PlayerState;
}
export interface StatsEvent {
    op: "stats";
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: NodeStats["memory"];
    cpu: NodeStats["cpu"];
    frameStats?: NodeStats["frameStats"];
}
export interface TrackStartEvent {
    op: "event";
    type: "TrackStartEvent";
    guildId: string;
    track: TrackData;
}
export interface TrackEndEvent {
    op: "event";
    type: "TrackEndEvent";
    guildId: string;
    track: TrackData;
    reason: TrackEndReason;
}
export interface TrackExceptionEvent {
    op: "event";
    type: "TrackExceptionEvent";
    guildId: string;
    track: TrackData;
    exception: ExceptionData;
}
export interface TrackStuckEvent {
    op: "event";
    type: "TrackStuckEvent";
    guildId: string;
    track: TrackData;
    thresholdMs: number;
}
export interface WebSocketClosedEvent {
    op: "event";
    type: "WebSocketClosedEvent";
    guildId: string;
    code: number;
    byRemote: boolean;
    reason: string;
}
export type TrackEndReason = "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup";
export type LavalinkEvent = ReadyEvent | PlayerUpdateEvent | StatsEvent | TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent | WebSocketClosedEvent;
export interface LavalinkInfo {
    version: {
        semver: string;
        major: number;
        minor: number;
        patch: number;
        preRelease?: string;
        build?: string;
    };
    buildTime: number;
    git: {
        branch: string;
        commit: string;
        commitTime: number;
    };
    jvm: string;
    lavaplayer: string;
    sourceManagers: string[];
    filters: string[];
    plugins: LavalinkPluginInfo[];
}
export interface LavalinkPluginInfo {
    name: string;
    version: string;
}
export interface SessionConfig {
    resumingKey?: string;
    timeout?: number;
}
export interface Session {
    resuming: boolean;
    timeout: number;
}
export interface RoutePlannerStatus {
    class?: string;
    details?: {
        ipBlock: {
            type: string;
            size: string;
        };
        failingAddresses: {
            address: string;
            failingTimestamp: number;
            failingTime: string;
        }[];
        blockIndex: string;
        currentAddressIndex: string;
    };
}
export interface PluginManifest {
    name: string;
    version: string;
    author?: string;
    description?: string;
}
export interface LavalinkPlugin {
    name: string;
    version: string;
}
export interface QueueOptions {
    maxSize?: number;
    duplicateTrackTimeout?: number;
    historySize?: number;
}
export interface QueueEntry {
    track: TrackData;
    requester?: string;
    requesterId?: string;
    addedAt: number;
}
export interface TrackBuilderOptions {
    encoded?: string;
    identifier?: string;
    userData?: Record<string, unknown>;
    info?: Partial<TrackInfo>;
}
export interface DALinkOptions {
    nodes: NodeOptions[];
    sendVoiceUpdate: (guildId: string, payload: VoicePacket) => void;
    defaultSearchPlatform?: SearchPlatform;
    autoPlay?: boolean;
    autoPlayFunction?: (player: PlayerLike, track: TrackData) => Promise<TrackData | null>;
    userAgent?: string;
    restTimeout?: number;
    maxErrorsPerNode?: number;
    autoResume?: boolean;
    resumeTimeout?: number;
    plugins?: PluginLike[];
    cache?: CacheOptions;
    queue?: QueueOptions;
    playerOptions?: Partial<PlayerOptions>;
}
export type SearchPlatform = "youtube" | "ytmsearch" | "ytsearch" | "soundcloud" | "scsearch" | "spotify" | "spsearch" | "applemusic" | "amsearch" | "deezer" | "dzsearch" | "yandexmusic" | "ymsearch" | "jiosaavn" | "jisearch";
export interface CacheOptions {
    enabled?: boolean;
    maxSize?: number;
    ttl?: number;
}
export interface PlayerLike {
    guildId: string;
    voiceChannelId: string;
    textChannelId?: string;
    playing: boolean;
    paused: boolean;
    volume: number;
    position: number;
    currentTrack: TrackData | null;
    queue: QueueLike;
    node: NodeLike;
}
export interface QueueLike {
    current: TrackData | null;
    size: number;
    isEmpty: boolean;
    add(track: TrackData | TrackData[], requester?: string): void;
    remove(index: number): TrackData | null;
    clear(): void;
    shuffle(): void;
    skip(): TrackData | null;
    previous(): TrackData | null;
    toArray(): TrackData[];
}
export interface NodeLike {
    id: string;
    stats: NodeStats;
    connected: boolean;
    penalties: number;
}
export interface PluginLike {
    name: string;
    version?: string;
    load?(dalink: unknown): void;
    unload?(): void;
    on?(event: string, ...args: unknown[]): void;
}
export interface Track {
    readonly encoded: string;
    readonly info: TrackInfo;
    readonly pluginInfo: Record<string, unknown>;
    readonly userData: Record<string, unknown>;
    setUserData(data: Record<string, unknown>): void;
    readonly displayTitle: string;
    readonly displayAuthor: string;
    readonly duration: string;
    readonly uri: string;
    readonly artworkUrl: string;
    readonly isStream: boolean;
    readonly isSeekable: boolean;
    readonly sourceName: string;
    readonly identifier: string;
}
export interface DALinkEvents {
    nodeCreate: [node: NodeLike];
    nodeDestroy: [node: NodeLike];
    nodeConnect: [node: NodeLike];
    nodeDisconnect: [node: NodeLike, reason: string];
    nodeError: [node: NodeLike, error: Error];
    nodeStats: [node: NodeLike, stats: NodeStats];
    nodePenaltiesUpdate: [node: NodeLike, penalties: PenaltyData];
    playerCreate: [player: PlayerLike];
    playerDestroy: [player: PlayerLike];
    playerMove: [player: PlayerLike, oldChannel: string, newChannel: string];
    playerDisconnect: [player: PlayerLike, voiceChannel: string];
    queueEnd: [player: PlayerLike];
    trackStart: [player: PlayerLike, track: TrackData];
    trackEnd: [player: PlayerLike, track: TrackData, reason: TrackEndReason];
    trackStuck: [player: PlayerLike, track: TrackData, thresholdMs: number];
    trackError: [player: PlayerLike, track: TrackData, error: ExceptionData];
    socketClosed: [player: PlayerLike, code: number, reason: string, byRemote: boolean];
    debug: [message: string];
    error: [error: Error];
    raw: [node: NodeLike, payload: Record<string, unknown>];
}
export type DALinkEventName = keyof DALinkEvents;
//# sourceMappingURL=index.d.ts.map