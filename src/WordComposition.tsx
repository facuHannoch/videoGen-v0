import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { videoStore } from "./state/videoStore";
import { StandardText } from "./videoCompositions/text/StandardText";
import { BlackAbsoluteFill } from "./videoCompositions/fills/BlackAbsoluteFill";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";
import { IntroNoise } from "./videoCompositions/fills/IntroNoise";
import { StandardTextLetterHighlighted } from "./videoCompositions/text/StandardTextLetterHighlighted";
import { TopPrompt } from "./videoCompositions/text/TopPrompt";
import { Wave } from "./videoCompositions/effects/WaveReveal";
import { WaveCoverFill } from "./videoCompositions/fills/WaveCoverFill";
import { SpeakerOnIcon } from "./videoCompositions/vectors/SpeakerOnIcon";
import { TickingClock } from "./videoCompositions/effects/TickingClock";
import { ScreenSweepShader } from "./videoCompositions/effects/ScreenSweepShader";


export const WordPronunciationVideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();

  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  const wordBreakdown = {
    word: "thought",
    ipa: "/θɔt/",
    breakdown: [
      { θ: ["thin", "think", "bath"] },
      { ɔ: ["law", "saw", "caught"] },
      { t: ["tap", "ten", "cat"] },
    ],
  };

  const word = wordBreakdown.word;
  const wordIPA = wordBreakdown.ipa;

  const phonemeBreakdownScenes = wordBreakdown.breakdown.map((entry) => {
    const [highlightedCharacter] = Object.entries(entry)[0] ?? [""];

    return (
      <>
        {/* <TwoStains /> */}
        <Audio src={staticFile("sounds/subtle-chime.mp3")} />

        <TopPrompt text={`Sound / ${highlightedCharacter} /`} />
        {/* <div> */}

        {/* <Audio src={staticFile("sounds/mouse-click-double-hard.mp3")} volume={0.5} /> */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
          <StandardTextLetterHighlighted
            text={wordIPA}
            style={{ fontSize: 72, padding: "24px 30px" }}
            highlightedCharacter={highlightedCharacter}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            {/* <StandardText text={relatedWords[0]} style={{ fontSize: 60, padding: "18px 26px" }} />
            <StandardText text={relatedWords[1]} style={{ fontSize: 60, padding: "18px 26px" }} />
            <StandardText text={relatedWords[2]} style={{ fontSize: 60, padding: "18px 26px" }} /> */}
          </div>
        </div>
      </>
    );
  });

  const scenes = [
    [
      // intro
      <>
        <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} />

        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
        <Wave velocity={3} mode="reveal" />
        <TopPrompt
          text="Activate the sound to hear"
          icon={<SpeakerOnIcon size={30} />}
        />
      </>
    ],
    [
      // tick space
      <>
        {/* <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} /> */}
      </>
    ],
    [
      // it is said...
      <>
      </>
    ],
    [
      // (word revelation)
      <>
        <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />

        {/* <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
          <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />
        </div> */}
      </>
    ],
    [
      // I will show you each
      <>
        <StandardText text={"Veamos cada sonido..."} style={{ fontSize: 72, padding: "24px 30px" }} />
        <Audio src={staticFile("sounds/mouse-click-double-hard.mp3")} volume={0.5} />
        <Sequence from={timelineClips[4].durationFrames - videoStore.getFrameForSeconds(0.5)} >
          <ScreenSweepShader />
          <Audio src={staticFile("sounds/swoosh-not-end.mp3")} />
          <Sequence from={videoStore.getFrameForSeconds(0.3)}>
            <WaveCoverFill></WaveCoverFill>
          </Sequence>
        </Sequence>
      </>
    ],
    ...phonemeBreakdownScenes,// .flatMap(item => [ item, item ] // Array(2).fill(item)),
    [
      <> <Sequence from={-5}>
        <Audio src={staticFile("sounds/swoosh-not-end.mp3")} />
      </Sequence>
        <Wave velocity={2} mode="cover" />
        <Sequence from={Math.ceil(34 / 2) - 4}>
          <WaveCoverFill>
            <StandardText text="IPA Coach" style={{ fontSize: 108, padding: "24px 30px", }} />
          </WaveCoverFill>
        </Sequence>
      </>
    ]
  ];


  return (
    <>
      <IntroNoise />
      <Sequence from={videoStore.getFrameForSeconds(1)} durationInFrames={videoStore.framesToAudio(2) + videoStore.getFrameForSeconds(1.5)}>
        {/* Note that this has the following logic: we want to start 1 second after the second 0, and we want the scene to last until the 2nd audio (audio[1]). videoStore.framesToAudio does not account for non-audio, so we have to manually add the duration of the sound scene in between (1.5 seconds) */}
        <Audio src={staticFile("sounds/clock-ticking/double-medium-medium_soft.mp3")} volume={0.4} />
        <div style={{ position: "absolute", bottom: 500, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <TickingClock tickEveryFrames={8} size={280} />
        </div>
      </Sequence>


      {timelineClips.map((clip, sceneIndex) => {
        const src = clip.src;
        const sceneContent = scenes[sceneIndex] ?? null;

        // Handle gap clips (just reserve time, no content)
        if (clip.type === "gap") {
          return (
            <Sequence
              key={clip.id ?? `gap-${clip.startFrame}`}
              name="gap"
              from={clip.startFrame}
              durationInFrames={clip.durationFrames}
            >
              {sceneContent}
            </Sequence>
          );
        }

        if (!src) {
          return null;
        }

        if (clip.type === "sfx") {
          return (
            <Sequence
              key={clip.id ?? `${src}-${clip.startFrame}`}
              name={src.split("/").pop()}
              from={clip.startFrame}
              durationInFrames={clip.durationFrames}
            >
              <BlackAbsoluteFill>
                <Audio src={staticFile(src)} volume={clip.volume ?? 1} />
                {sceneContent}
                {/* <OneWordCaption wordTimings={audio.wordTimings} /> */}
              </BlackAbsoluteFill>
            </Sequence>

            // <Sequence
            //   key={clip.id ?? `${src}-${clip.startFrame}`}
            //   name={src.split("/").pop()}
            //   from={clip.startFrame}
            //   durationInFrames={clip.durationFrames}
            // >
            //   {sceneContent}

            //   <Audio src={staticFile(src)} volume={clip.volume ?? 1} />
            // </Sequence>
          );
        }

        const audio = videoStore.getAudio(src);
        if (!audio) {
          return null;
        }

        return (
          <Sequence
            key={clip.id ?? `${src}-${clip.startFrame}`}
            name={src.split("/").pop()}
            from={clip.startFrame}
            durationInFrames={clip.durationFrames}
          >
            <BlackAbsoluteFill>
              <Audio src={staticFile(src)} volume={clip.volume ?? 1} />
              {sceneContent}
              <OneWordCaption wordTimings={audio.wordTimings} />
            </BlackAbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};
