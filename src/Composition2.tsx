import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { videoStore } from "./storage/videoStore";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";

const PHONEME = "p";

const EXAMPLE_WORDS = [
  { word: "pen", ipa: "/pɛn/" },
  { word: "pie", ipa: "/paɪ/" },
  { word: "cap", ipa: "/kæp/" },
];

type SceneSfxCue = {
  src: string;
  fromFraction: number;
  volume: number;
};

const SCENE_SFX: Record<number, SceneSfxCue[]> = {
  0: [
    { src: "sounds/ipa-p/chime.mp3", fromFraction: 0, volume: 0.18 },
    { src: "sounds/ipa-p/ui-click.wav", fromFraction: 0.18, volume: 0.45 },
  ],
  1: [
    { src: "sounds/ipa-p/button.wav", fromFraction: 0.06, volume: 0.5 },
    { src: "sounds/ipa-p/future-transition.wav", fromFraction: 0.78, volume: 0.22 },
  ],
  2: [{ src: "sounds/ipa-p/swoosh.mp3", fromFraction: 0.04, volume: 0.42 }],
  3: [{ src: "sounds/ipa-p/click-complex.wav", fromFraction: 0.06, volume: 0.4 }],
  4: [{ src: "sounds/ipa-p/ui-click.wav", fromFraction: 0.06, volume: 0.42 }],
  5: [{ src: "sounds/ipa-p/button.wav", fromFraction: 0.06, volume: 0.48 }],
  6: [{ src: "sounds/ipa-p/alien-transition.wav", fromFraction: 0, volume: 0.18 }],
  7: [
    { src: "sounds/ipa-p/noisy-impact.wav", fromFraction: 0, volume: 0.2 },
    { src: "sounds/ipa-p/soft-impact.mp3", fromFraction: 0.72, volume: 0.55 },
  ],
  8: [
    { src: "sounds/ipa-p/future-transition.wav", fromFraction: 0, volume: 0.2 },
    { src: "sounds/ipa-p/chime.mp3", fromFraction: 0.66, volume: 0.14 },
  ],
};

const SceneBackdrop = ({ sceneIndex }: { sceneIndex: number }) => {
  const frame = useCurrentFrame();

  const glowDrift = Math.sin((frame + sceneIndex * 14) / 30) * 45;
  const hueA = 170 + sceneIndex * 18;
  const hueB = 220 + sceneIndex * 11;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 20% 20%, hsla(${hueA}, 80%, 60%, 0.28), transparent 40%), radial-gradient(circle at 80% 80%, hsla(${hueB}, 90%, 62%, 0.22), transparent 46%), linear-gradient(145deg, #05080d 0%, #0e1726 46%, #06090f 100%)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(132,246,255,0.26) 0%, rgba(132,246,255,0) 72%)",
          left: -180 + glowDrift,
          top: -200,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,182,120,0.20) 0%, rgba(255,182,120,0) 70%)",
          right: -220 - glowDrift,
          bottom: -260,
          filter: "blur(12px)",
        }}
      />
    </AbsoluteFill>
  );
};

const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      style={{
        padding: "26px 34px",
        borderRadius: 26,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "linear-gradient(160deg, rgba(248,252,255,0.95) 0%, rgba(224,236,247,0.90) 100%)",
        color: "#0e1726",
        boxShadow: "0 24px 58px rgba(0,0,0,0.45)",
        textAlign: "center",
        maxWidth: "82%",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const SceneContent = ({ index }: { index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inSpring = spring({ fps, frame, config: { damping: 18, stiffness: 130 } });
  const rise = interpolate(inSpring, [0, 1], [36, 0]);
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  if (index === 0) {
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px)`, display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
        <div style={{ letterSpacing: 6, color: "#a3e6ff", fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 28, fontWeight: 700 }}>
          IPA COACH
        </div>
        <Card>
          <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontWeight: 800, fontSize: 78, lineHeight: 1.06 }}>
            Improve your English pronunciation
          </div>
        </Card>
      </div>
    );
  }

  if (index === 1) {
    const pulse = interpolate(Math.sin(frame / 16), [-1, 1], [0.98, 1.02]);
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px) scale(${pulse})` }}>
        <Card style={{ minWidth: 460 }}>
          <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 162, fontWeight: 800, lineHeight: 1 }}>
            /{PHONEME}/
          </div>
        </Card>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px)` }}>
        <Card>
          <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 70, fontWeight: 800 }}>
            Hear it in words like
          </div>
        </Card>
      </div>
    );
  }

  if (index >= 3 && index <= 5) {
    const example = EXAMPLE_WORDS[index - 3];
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px)`, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <Card style={{ minWidth: 580 }}>
          <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 148, fontWeight: 800, textTransform: "lowercase", lineHeight: 1 }}>
            {example.word}
          </div>
          <div style={{ marginTop: 10, fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 80, fontWeight: 700, color: "#1f3550" }}>
            {example.ipa}
          </div>
        </Card>
      </div>
    );
  }

  if (index === 6) {
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px)` }}>
        <Card>
          <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
            How to make this sound
          </div>
        </Card>
      </div>
    );
  }

  if (index === 7) {
    const diagramPop = interpolate(frame, [0, 14], [0.88, 1], { extrapolateRight: "clamp" });
    return (
      <div style={{ opacity: fade, transform: `translateY(${rise}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Img
          src={staticFile("images/diagram.png")}
          style={{
            width: 680,
            borderRadius: 20,
            border: "2px solid rgba(255,255,255,0.24)",
            boxShadow: "0 26px 68px rgba(0,0,0,0.48)",
            transform: `scale(${diagramPop})`,
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ opacity: fade, transform: `translateY(${rise}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <Card>
        <div style={{ fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 68, fontWeight: 800, lineHeight: 1.08 }}>
          Want to sound like a native?
        </div>
        <div style={{ marginTop: 8, fontFamily: "Sora, Poppins, Avenir Next, sans-serif", fontSize: 46, fontWeight: 700, color: "#33506f" }}>
          Full lesson in the description
        </div>
      </Card>
    </div>
  );
};

export const VideoComposition = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const audios = videoStore.getAllAudios();

  const fadeDuration = fps;
  const musicVolume = interpolate(frame, [0, fadeDuration], [0, 0.24], {
    extrapolateRight: "clamp",
  });

  return (
    <>
      <Sequence
        durationInFrames={
          (audios[0]?.durationInFrames ?? 0) + (audios[1]?.durationInFrames ?? 0)
        }
      >
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={musicVolume}
        />
      </Sequence>

      <Series>
        {audios.map((audio, index) => {
          const sceneSfx = SCENE_SFX[index] ?? [];
          return (
            <Series.Sequence
              name={audio.src.split("/")[1]}
              key={audio.src}
              durationInFrames={audio.durationInFrames}
            >
              <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                <SceneBackdrop sceneIndex={index} />

                <Audio src={staticFile(audio.src)} volume={1} />

                {sceneSfx.map((cue, cueIndex) => (
                  <Sequence
                    key={`${index}-${cue.src}-${cueIndex}`}
                    from={Math.max(
                      Math.floor(audio.durationInFrames * cue.fromFraction),
                      0
                    )}
                  >
                    <Audio src={staticFile(cue.src)} volume={cue.volume} />
                  </Sequence>
                ))}

                <SceneContent index={index} />

                <OneWordCaption wordTimings={audio.wordTimings} />
              </AbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>
    </>
  );
};
