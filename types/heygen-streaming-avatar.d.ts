// types/heygen-streaming-avatar.d.ts
// Type shim for @heygen/streaming-avatar whose npm publish is missing the built lib/.
// These declarations match the public API of StreamingAvatarSDK v2.x.

declare module "@heygen/streaming-avatar" {
  export enum AvatarQuality {
    Low = "low",
    Medium = "medium",
    High = "high",
  }

  export enum StreamingEvents {
    AVATAR_START_TALKING = "avatar_start_talking",
    AVATAR_STOP_TALKING = "avatar_stop_talking",
    STREAM_DISCONNECTED = "stream_disconnected",
    STREAM_READY = "stream_ready",
    USER_START = "user_start",
    USER_STOP = "user_stop",
    USER_SILENCE = "user_silence",
  }

  export interface StartAvatarConfig {
    quality?: AvatarQuality;
    avatarName?: string;
    voice?: { voiceId?: string; rate?: number; emotion?: string };
    language?: string;
    disableIdleTimeout?: boolean;
    knowledgeBase?: string;
  }

  export interface SpeakConfig {
    text: string;
    taskType?: string;
  }

  export default class StreamingAvatar {
    constructor(config: { token: string });
    on(event: StreamingEvents, handler: (event: { detail: MediaStream }) => void): void;
    on(event: StreamingEvents, handler: () => void): void;
    createStartAvatar(config: StartAvatarConfig): Promise<void>;
    speak(config: SpeakConfig): Promise<void>;
    stopAvatar(): Promise<void>;
  }
}
