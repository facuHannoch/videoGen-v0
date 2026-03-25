import { getMediaMetadata } from "../utils/getMediaMetadata";
import { staticFile } from "remotion";

export const FPS = 30;

export interface WordTiming {
  tokenIndex: number;
  word: string;
  startMs: number;
  endMs: number;
  charStart?: number;
  charEnd?: number;
  isPunctuation?: boolean;
  confidence?: number;
}

export interface AudioInfoEntry {
  id: string;
  subtitle?: string;
  wordTimings?: WordTiming[];
}

export interface AudioMetadata {
  src: string;
  subtitle: string;
  wordTimings: WordTiming[];
  durationInSeconds: number;
  durationInFrames: number;
  dimensions: {
    width: number;
    height: number;
  } | null;
  fps: number | null;
}

export type TimelineLane = "speech" | "sfx" | "music" | string;

export interface AudioTimelineItem {
  id?: string;
  type: "audio";
  audioId: string;
  lane?: TimelineLane;
  startFrame?: number;
  volume?: number;
}

export interface SfxTimelineItem {
  id?: string;
  type: "sfx";
  soundId: string;
  lane?: TimelineLane;
  startFrame?: number;
  durationSeconds?: number;
  durationFrames?: number;
  volume?: number;
}

export interface GapTimelineItem {
  id?: string;
  type: "gap";
  lane?: TimelineLane;
  startFrame?: number;
  durationSeconds?: number;
  durationFrames?: number;
}

export type TimelineItem = AudioTimelineItem | SfxTimelineItem | GapTimelineItem;

export interface TimelineFile {
  fps?: number;
  items: TimelineItem[];
}

export interface TimelineClip {
  id?: string;
  type: "audio" | "sfx" | "gap";
  lane: TimelineLane;
  src?: string;
  audioId?: string;
  soundId?: string;
  startFrame: number;
  durationFrames: number;
  volume?: number;
}

class VideoStore {
  private audioMetadata: Map<string, AudioMetadata> = new Map();
  private orderedAudioSources: string[] = [];
  private timelineItems: TimelineItem[] = [];
  private timelineClips: TimelineClip[] = [];
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  public initPromise: Promise<void>;

//   public sumAudiosDuration: number;

  constructor() {
    // Initialize immediately
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadAudioMetadata();
    await this.loadTimeline();
  }

  /**
   * Load metadata for audios
   * @param audioSources Array of audio paths relative to public folder (e.g., "audios/my-audio.wav"). If not provided, loads all audios from manifest.
   */
  async loadAudioMetadata(audioSources?: Array<string | AudioInfoEntry>): Promise<void> {
    // Auto-discover all audios from manifest if no sources provided
    if (!audioSources) {
      try {
        const response = await fetch(staticFile("audio.info.json"));
        const manifest = await response.json();
        audioSources = manifest.audios || [];
      } catch (error) {
        console.error("Failed to load audios manifest:", error);
        return;
      }
    }

    const normalizedEntries = (audioSources ?? []).map((entry) => {
      const id = typeof entry === "string" ? entry : entry.id;
      const subtitle = typeof entry === "string" ? "" : (entry.subtitle ?? "");
      const wordTimings = typeof entry === "string" ? [] : (entry.wordTimings ?? []);
      const src = id.startsWith("audios/") ? id : `audios/${id}`;

      return { src, subtitle, wordTimings };
    });

    const normalizedSources = normalizedEntries.map((entry) => entry.src);

    this.orderedAudioSources = normalizedSources;

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        await Promise.all(
          normalizedEntries.map(async ({ src, subtitle, wordTimings }) => {
            const existing = this.audioMetadata.get(src);
            if (existing) {
              if (
                existing.subtitle !== subtitle ||
                existing.wordTimings !== wordTimings
              ) {
                this.audioMetadata.set(src, {
                  ...existing,
                  subtitle,
                  wordTimings,
                });
              }
              return; // Already loaded
            }

            const metadata = await getMediaMetadata(src);
            const durationInFrames = Math.ceil(
              metadata.durationInSeconds * FPS
            );

            this.audioMetadata.set(src, {
              src,
              subtitle,
              wordTimings,
              durationInSeconds: metadata.durationInSeconds,
              durationInFrames,
              dimensions: metadata.dimensions,
              fps: metadata.fps,
            });
          })
        );
      } finally {
        this.isLoading = false;
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  private getDefaultLane(item: TimelineItem): TimelineLane {
    if (item.type === "audio" || item.type === "gap") {
      return item.lane ?? "speech";
    }
    return item.lane ?? "sfx";
  }

  private getDurationFramesFromItem(item: SfxTimelineItem | GapTimelineItem): number {
    if (typeof item.durationFrames === "number" && item.durationFrames > 0) {
      return Math.ceil(item.durationFrames);
    }

    if (
      typeof item.durationSeconds === "number" &&
      item.durationSeconds > 0
    ) {
      return this.getFrameForSeconds(item.durationSeconds);
    }

    return 0;
  }

  private getAudioSrc(audioId: string): string {
    return audioId.startsWith("audios/") ? audioId : `audios/${audioId}`;
  }

  private getSoundSrc(soundId: string): string {
    return soundId.startsWith("sounds/") ? soundId : `sounds/${soundId}`;
  }

  private async ensureAudioMetadataForTimeline(audioId: string): Promise<AudioMetadata | null> {
    const src = this.getAudioSrc(audioId);
    const existing = this.audioMetadata.get(src);
    if (existing) {
      return existing;
    }

    try {
      const metadata = await getMediaMetadata(src);
      const durationInFrames = Math.ceil(metadata.durationInSeconds * FPS);
      const fallbackAudio: AudioMetadata = {
        src,
        subtitle: "",
        wordTimings: [],
        durationInSeconds: metadata.durationInSeconds,
        durationInFrames,
        dimensions: metadata.dimensions,
        fps: metadata.fps,
      };
      this.audioMetadata.set(src, fallbackAudio);
      if (!this.orderedAudioSources.includes(src)) {
        this.orderedAudioSources.push(src);
      }
      return fallbackAudio;
    } catch (error) {
      console.error(`Failed to resolve audio metadata for ${audioId}:`, error);
      return null;
    }
  }

  private async compileTimeline(items: TimelineItem[]): Promise<void> {
    let globalCursor = 0;
    const compiled: TimelineClip[] = [];

    for (const item of items) {
      const lane = this.getDefaultLane(item);
      const startFrame = Math.max(
        typeof item.startFrame === "number" ? item.startFrame : globalCursor,
        0
      );

      if (item.type === "audio") {
        const audio = await this.ensureAudioMetadataForTimeline(item.audioId);
        if (!audio) {
          continue;
        }

        compiled.push({
          id: item.id,
          type: "audio",
          lane,
          src: audio.src,
          audioId: item.audioId,
          startFrame,
          durationFrames: audio.durationInFrames,
          volume: item.volume,
        });

        globalCursor = Math.max(globalCursor, startFrame + audio.durationInFrames);
        continue;
      }

      if (item.type === "sfx") {
        const src = this.getSoundSrc(item.soundId);
        let durationFrames = this.getDurationFramesFromItem(item);

        if (durationFrames <= 0) {
          try {
            const metadata = await getMediaMetadata(src);
            durationFrames = Math.ceil(metadata.durationInSeconds * FPS);
          } catch (error) {
            console.error(`Failed to resolve sound metadata for ${item.soundId}:`, error);
            continue;
          }
        }

        compiled.push({
          id: item.id,
          type: "sfx",
          lane,
          src,
          soundId: item.soundId,
          startFrame,
          durationFrames,
          volume: item.volume,
        });

        globalCursor = Math.max(globalCursor, startFrame + durationFrames);
        continue;
      }

      const gapFrames = this.getDurationFramesFromItem(item);
      if (gapFrames <= 0) {
        continue;
      }

      compiled.push({
        id: item.id,
        type: "gap",
        lane,
        startFrame,
        durationFrames: gapFrames,
      });

      globalCursor = Math.max(globalCursor, startFrame + gapFrames);
    }

    this.timelineItems = items;
    this.timelineClips = compiled.sort((a, b) => a.startFrame - b.startFrame);
  }

  async loadTimeline(itemsOverride?: TimelineItem[]): Promise<void> {
    let items = itemsOverride;

    if (!items) {
      try {
        const response = await fetch(staticFile("timeline.json"));
        const timelineFile = (await response.json()) as TimelineFile;
        if (Array.isArray(timelineFile.items)) {
          items = timelineFile.items;
        }
      } catch {
        items = undefined;
      }
    }

    if (!items || items.length === 0) {
      const fallbackAudioItems: TimelineItem[] = this.getAllAudios().map((audio) => ({
        type: "audio",
        audioId: audio.src.replace(/^audios\//, ""),
      }));
      await this.compileTimeline(fallbackAudioItems);
      return;
    }

    await this.compileTimeline(items);
  }

  /**
   * Get metadata for a specific audio
   */
  getAudio(src: string): AudioMetadata | undefined {
    return this.audioMetadata.get(src);
  }

  /**
   * Get all loaded audios
   */
  getAllAudios(): AudioMetadata[] {
    return this.orderedAudioSources
      .map((src) => this.audioMetadata.get(src))
      .filter((audio): audio is AudioMetadata => audio !== undefined);
  }

  getTimelineItems(): TimelineItem[] {
    return [...this.timelineItems];
  }

  getTimelineClips(): TimelineClip[] {
    return [...this.timelineClips];
  }

  /**
   * Convert seconds to frames based on FPS constant
   */
  getFrameForSeconds(seconds: number): number {
    return Math.ceil(seconds * FPS);
  }

  /**
   * Get the duration in frames for an audio
   */
  getAudioDurationFrames(src: string): number | null {
    const audio = this.audioMetadata.get(src);
    return audio?.durationInFrames ?? null;
  }

  /**
   * Get the frame where the audio at the given zero-based index starts.
   * Example: index 0 => 0, index 1 => duration of audio 0.
   */
  getFrameForAudioIndex(index: number): number {
    if (index <= 0) {
      return 0;
    }

    const audios = this.getAllAudios();
    return audios
      .slice(0, index)
      .reduce((total, audio) => total + audio.durationInFrames, 0);
  }

  /**
   * Get the frame where the nth audio starts, using 1-based numbering.
   * Example: nth=1 => 0, nth=7 => start frame of the 7th audio.
   */
  framesToAudio(nth: number): number {
    return this.getFrameForAudioIndex(Math.max(nth - 1, 0));
  }

  /**
   * Get total video duration in frames (sum of all audios)
   */
  getTotalDurationFrames(): number {
    if (this.timelineClips.length > 0) {
      return this.timelineClips.reduce((maxEnd, clip) => {
        const clipEnd = clip.startFrame + clip.durationFrames;
        return Math.max(maxEnd, clipEnd);
      }, 0);
    }

    return this.getAllAudios().reduce((total, audio) => total + audio.durationInFrames, 0);
  }

  /**
   * Get total video duration in seconds (sum of all audios)
   */
  getTotalDurationSeconds(): number {
    return Array.from(this.audioMetadata.values()).reduce(
      (total, audio) => total + audio.durationInSeconds,
      0
    );
  }


  getFPS(): number {
    return FPS;
  }

  /**
   * Clear all cached metadata
   */
  clear(): void {
    this.audioMetadata.clear();
    this.orderedAudioSources = [];
    this.timelineItems = [];
    this.timelineClips = [];
  }
}

export const videoStore = new VideoStore();
