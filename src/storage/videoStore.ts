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

class VideoStore {
  private audioMetadata: Map<string, AudioMetadata> = new Map();
  private orderedAudioSources: string[] = [];
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  public initPromise: Promise<void>;

//   public sumAudiosDuration: number;

  constructor() {
    // Initialize immediately
    this.initPromise = this.loadAudioMetadata();
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
   * Get total video duration in frames (sum of all audios)
   */
  getTotalDurationFrames(): number {
    return Array.from(this.audioMetadata.values()).reduce(
      (total, audio) => total + audio.durationInFrames,
      0
    );
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
  }
}

export const videoStore = new VideoStore();
