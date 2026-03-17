import { FPS } from "./videoStore";
import { getMediaMetadata } from "../utils/getMediaMetadata";

export interface SoundMetadata {
  src: string;
  durationInSeconds: number;
  durationInFrames: number;
  dimensions: {
    width: number;
    height: number;
  } | null;
  fps: number | null;
}

const DEFAULT_SOUND_SOURCES = [
  "sounds/bell-98033.mp3",
  "sounds/chutter-click-494024.mp3",
  "sounds/mouse-click-sfx-478755.mp3",
];

class SoundStore {
  private soundMetadata: Map<string, SoundMetadata> = new Map();
  private orderedSoundSources: string[] = [];
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  public initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.loadSoundMetadata();
  }

  async loadSoundMetadata(soundSources: string[] = DEFAULT_SOUND_SOURCES): Promise<void> {
    const normalizedSources = soundSources.map((src) =>
      src.startsWith("sounds/") ? src : `sounds/${src}`
    );

    this.orderedSoundSources = normalizedSources;

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        await Promise.all(
          normalizedSources.map(async (src) => {
            if (this.soundMetadata.has(src)) {
              return;
            }

            const metadata = await getMediaMetadata(src);
            const durationInFrames = Math.ceil(metadata.durationInSeconds * FPS);

            this.soundMetadata.set(src, {
              src,
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

  getSound(src: string): SoundMetadata | undefined {
    const normalized = src.startsWith("sounds/") ? src : `sounds/${src}`;
    return this.soundMetadata.get(normalized);
  }

  getAllSounds(): SoundMetadata[] {
    return this.orderedSoundSources
      .map((src) => this.soundMetadata.get(src))
      .filter((sound): sound is SoundMetadata => sound !== undefined);
  }

  getSoundDurationFrames(src: string): number | null {
    const sound = this.getSound(src);
    return sound?.durationInFrames ?? null;
  }

  getSoundDurationSeconds(src: string): number | null {
    const sound = this.getSound(src);
    return sound?.durationInSeconds ?? null;
  }

  clear(): void {
    this.soundMetadata.clear();
    this.orderedSoundSources = [];
  }
}

export const soundStore = new SoundStore();