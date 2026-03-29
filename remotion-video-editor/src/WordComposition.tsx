import { Img, Sequence, staticFile } from "remotion";
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
import { CSSProperties } from "react";

// Define word, ipa transcription
// Edit script.xml
// Edit timeline.json <-- or make it created with a) audioGen; b) videoStore


// Add music
// The video has like 0.5 seconds of silence. Make the bell sound as soon as the video starts, not half a second after
// It is very plain and dull

export const WordPronunciationVideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();
  console.log(videoStore)
  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  const wordBreakdown = {
    word: "bed",
    ipa: "/bɛd/",
    breakdown: [
      { b: ["bat", "boy", "cab"] },
      { ɛ: ["bet", "pen", "head"] },
      { d: ["day", "dog", "mad"] },
    ],
  };

  const word = wordBreakdown.word;
  const wordIPA = wordBreakdown.ipa;
  const language = "en"; // Target language from part-2 of content_json

  // Generate phoneme scenes dynamically from wordBreakdown
  const generatePhonemeScenes = () => {
    return wordBreakdown.breakdown.flatMap((entry, index) => {
      const [phoneme, words] = Object.entries(entry)[0];

      return [
        [
          // phoneme explanation
          <>
            <TopPrompt text={`Sound / ${phoneme} /`} />
            <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
            <Img
              src={staticFile(`images/phonemes-illustrative-images/${language}/diagram-${phoneme}.png`)}
              style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain", position: 'absolute', top: 500 }}
            />
            <IPAPhonemeScene
              key={`phoneme-explanation-${phoneme}`}
              wordIPA={wordIPA}
              highlightedCharacter={phoneme}
              containerStyle={{ position: 'absolute', top: 280 }}
              sound={false}
            />
          </>
        ],
        [
          // phoneme words
          <IPAPhonemeScene
            key={`phoneme-words-${phoneme}`}
            word={word}
            wordIPA={wordIPA}
            highlightedCharacter={phoneme}
            exampleWords={words}
          />
        ]
      ];
    });
  };

  const scenes = [
    [
      // intro
      <>
        <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} />

        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
        <Wave velocity={3} mode="reveal" />
        <TopPrompt
          text="Turn sound on"
          icon={<SpeakerOnIcon size={30} />}
        />
      </>
    ],
    [
      // gap
      <BlackAbsoluteFill>
        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
      </BlackAbsoluteFill>
    ],
    [
      // word revelation
      <>
        <BlackAbsoluteFill>
          <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />
        </BlackAbsoluteFill>

      </>
    ],
    [
      // Let's see each phoneme
      <>
        <StandardText text={"Let's look at each phoneme"} style={{ fontSize: 72, padding: "24px 30px" }} />
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
    ...generatePhonemeScenes(),
    [
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      <>
        <Sequence from={-5}>
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
      <Sequence from={videoStore.getFrameForSeconds(1)} durationInFrames={videoStore.framesToAudio(1) + videoStore.getFrameForSeconds(1.5)}>
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

interface IPAPhonemeSceneProps {
  word?: string;
  wordIPA: string;
  highlightedCharacter: string;
  audioSceneIndex?: number;
  containerStyle?: CSSProperties;
  sound?: boolean;
  exampleWords?: string[];
}

const IPAPhonemeScene = ({
  word,
  wordIPA,
  highlightedCharacter,
  audioSceneIndex = 0,
  containerStyle,
  sound = true,
  exampleWords = []
}: IPAPhonemeSceneProps) => {
  return (
    <>
      <div style={containerStyle}>

        {sound &&
          <Sequence durationInFrames={videoStore.getFrameForSeconds(0.5)}>
            <Audio src={staticFile("sounds/subtle-chime.mp3")} />
          </Sequence>
        }

        {/* <TopPrompt text={`Sound / ${highlightedCharacter} /`} /> */}

        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          {word && <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />}
          <StandardTextLetterHighlighted
            text={wordIPA}
            style={{ fontSize: 72, padding: "24px 35px" }}
            highlightedCharacter={highlightedCharacter}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            {exampleWords.map((exWord) => (
              <StandardText key={exWord} text={exWord} style={{ fontSize: 48, padding: "10px 20px" }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
