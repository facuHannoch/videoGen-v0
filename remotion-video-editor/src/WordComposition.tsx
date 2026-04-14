import { Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
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
import { ScreenSweepShader } from "./videoCompositions/effects/ScreenSweepShader";
import { CSSProperties } from "react";
import airbagData from "./content.json"; // Assumes content.json is in the same directory and contains the JSON data
import { SpeakerOnIcon } from "./videoCompositions/vectors/SpeakerOnIcon";

type ContentPart = {
  id: string;
  title: string;
  content: string;
};

type ContentData = {
  parts: ContentPart[];
};

const WEBSITE_URL = "https://ipacoach.com/en/practice/walk"

// Composition Component for Word Pronunciation
export const WordPronunciationVideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();

  // Guard against empty timelineClips
  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  // Find the required part from JSON based on content.json structure
  const contentData = airbagData as ContentData;
  // UPDATED: 'VIDEO CONTENT' title is for part-1, which has the main content
  const jsonDataPart = contentData.parts.find((part: ContentPart) => part.title === "VIDEO CONTENT");
  if (!jsonDataPart) {
    return <StandardText text="Word data not found" />
  }
  const wordData = JSON.parse(jsonDataPart.content);

  const word = wordData.word;
  const wordIPA = wordData.ipa;

  // UPDATED: Language code from JSON part-2 (titled 'Language')
  const languageCodePart = contentData.parts.find((part: ContentPart) => part.title === "Language");
  const targetLanguage = languageCodePart ? languageCodePart.content : "en"; // Use "en" as fallback

  // Generate phoneme scenes dynamically from wordData.breakdown
  const generatePhonemeScenes = () => {
    return wordData.breakdown.flatMap((entry: any, index: number) => {
      const phoneme = entry.phoneme;

      // Get only the words from each entry for example words
      const explanationWords = entry.words;
      // UPDATED: Dynamic text based on language and data structure
      const promptText = `Sound / ${phoneme} /`;

      return [
        [
          // phoneme explanation - dynamic sound/image loading
          <>
            <TopPrompt text={promptText} />
            <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
            <Img
              // Path dynamically constructed: images/phonemes-illustrative-images/[targetLanguage]/diagram-[phoneme].png
              src={staticFile(`images/phonemes-illustrative-images/${targetLanguage.toLowerCase()}/diagram-${phoneme}.png`)}
              style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain", position: 'absolute', top: 500 }}
            />
            <IPAPhonemeScene
              key={`phoneme-explanation-${phoneme}`}
              wordIPA={wordIPA}
              highlightedCharacter={phoneme}
              containerStyle={{ position: 'absolute', top: 280 }}
              sound={false} // No sound for explanation scene in breakdown structure based on previous example
            />
          </>
        ],
        [
          // phoneme words - dynamic scene index logic can be complex without pre-calculation
          <IPAPhonemeScene
            key={`phoneme-words-${phoneme}`}
            word={word} // Main word shown with breakdown
            wordIPA={wordIPA} // IPA transcription
            highlightedCharacter={phoneme} // Character to highlight
            exampleWords={explanationWords} // Passing the words array
          />
        ]
      ];
    });
  };

  // UPDATED: Scene contents based on English language resources and timeline positions
  const scenes = [
    [
      // intro - 01_i-ll_teach_you_how_to_pronounce_this_word.wav
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
      // word pronunciation - 02_thought.wav
      <>
        <BlackAbsoluteFill>
          <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px", margin: "1rem" }} />
          <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />
        </BlackAbsoluteFill>

      </>
    ],
    [
      // transition to breakdown - 03_let-s_look_at_each_phoneme.wav
      <>
        {/* UPDATED: English text */}
        <StandardText text={"Let's look at each phoneme"} style={{ fontSize: 72, padding: "24px 30px" }} />
        <Audio src={staticFile("sounds/mouse-click-double-hard.mp3")} volume={0.5} />
        <Sequence from={timelineClips[3].durationFrames - videoStore.getFrameForSeconds(0.5)} >
          <ScreenSweepShader />
          <Audio src={staticFile("sounds/swoosh-not-end.mp3")} />
          <Sequence from={videoStore.getFrameForSeconds(0.3)}>
            <WaveCoverFill></WaveCoverFill>
          </Sequence>
        </Sequence>
      </>
    ],
    ...generatePhonemeScenes(), // Injects scenes (explanation + words for phonemes)
    [
      // final pronunciation 1 - 10_thought.wav
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      // final sentence - 11_i_thought_about_it_yesterday.wav
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <BlackAbsoluteFill>
          <StandardText text={"I thought about it yesterday"} style={{ fontSize: 72, padding: "24px 30px" }} />
        </BlackAbsoluteFill>
      </div>
    ],
    [
      // final pronunciation 2 - 12_thought.wav
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      // Want to practice?
      <>
        <StandardText text={"just hearing is not enough..."} style={{ fontSize: 72, padding: "24px 30px" }} />
      </>
    ],
    [
      // CTA
      <>
        {/* <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} /> */}
        <StandardText text={"Don't just scroll and forget..."} style={{ fontSize: 56, color: "red", padding: "24px 30px", margin: "12px" }} />
        <StandardText text={"practice it in less than 60 seconds"} style={{ fontSize: 56, padding: "24px 30px", margin: "24px" }} />

        {/* <Wave velocity={3} mode="reveal" /> */}
      </>
    ],
    [
      // outro - SFX - mouse-click-double-soft
      <>
        <BlackAbsoluteFill>
          <Wave velocity={2} mode="cover" />
          <Sequence from={Math.ceil(34 / 2) - 4}>
            <WaveCoverFill>
              <StandardText text="IPA Coach" style={{ fontSize: 108, padding: "24px 30px", }} />
            </WaveCoverFill>
          </Sequence>
        </BlackAbsoluteFill>
        <Sequence from={-5}>
          <Audio src={staticFile("sounds/swoosh-not-end.mp3")} volume={0.5} />
        </Sequence>
      </>
    ],
  ];

  // const clockvideoStore.framesToAudio(1) + videoStore.getFrameForSeconds(3)

  const shutterDuration = videoStore.getFrameForSeconds(0.2)
  const fadeDuration = videoStore.getFPS()
  const volume = interpolate(
    useCurrentFrame(),
    [0, fadeDuration],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );


  return (
    <>
      <IntroNoise />

      {/* <Sequence from={shutterDuration*2} durationInFrames={videoStore.framesToAudio(2) + videoStore.getFrameForSeconds(3) - shutterDuration*2} >
        <Audio src={staticFile("music/tension-pulse-1.mp3")} volume={0.15} />
      </Sequence> */}
      {/* <Audio src={staticFile("music/dark-pop.m4a")} volume={0.1} /> */}

      {/* <Sequence from={videoStore.getFrameForSeconds(1)} durationInFrames={videoStore.getFrameForSeconds(3)}>
        <Audio src={staticFile("music/tension-pulse-1.mp3")} volume={0.2} />
      </Sequence> */}
      {/* <Sequence from={videoStore.framesToAudio(2) + videoStore.getFrameForSeconds(3) - shutterDuration} durationInFrames={videoStore.getFrameForSeconds(1)}>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
      </Sequence > */}
      <Sequence from={0} durationInFrames={videoStore.framesToAudio(3) - videoStore.getFrameForSeconds(1)}>
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={volume}
        />
      </Sequence>
      <Sequence from={videoStore.framesToAudio(3) - videoStore.getFrameForSeconds(1)} durationInFrames={120}>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
      </Sequence>


      <StandardTextLetterHighlighted text="Gamified english pronunciation learning at ipacoach.com/program" highlightedCharacter="ipacoach.com/program" style={{fontSize: 24, margin: "12px", backgroundColor: "#bfc8d6DF"}} highlightedStyle={{fontSize: 24, color: "#0c336e"}} />

      {
        timelineClips.map((clip, sceneIndex) => {
          const src = clip.src;
          const sceneContent = scenes[sceneIndex] ?? null;

          // Handle gap clips (just reserve time, no content unless added to `scenes`)
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

          // Handle missing audio file path gracefully
          if (!src) {
            return null;
          }

          // Handle SFX clips separately, placing them in BlackAbsoluteFill with optional scene content
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
                  {/* OneWordCaption logic might need adaptation for SFX if word timings are unavailable */}
                </BlackAbsoluteFill>
              </Sequence>
            );
          }

          // Load Audio metadata from store
          const audio = videoStore.getAudio(src);
          if (!audio) {
            return null;
          }

          // Render standard audio clips with OneWordCaption and custom scene content
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
                {/* Captions are always rendered when possible based on current video structure */}
                <OneWordCaption wordTimings={audio.wordTimings} />
              </BlackAbsoluteFill>
            </Sequence>
          );
        })
      }
    </>
  );
};

// Interface for Phoneme Scene Props
interface IPAPhonemeSceneProps {
  word?: string; // Main word, optional based on scene type
  wordIPA: string; // IPA transcription of the word
  highlightedCharacter: string; // Phoneme character to highlight in wordIPA
  containerStyle?: CSSProperties; // Styles for containing div
  sound?: boolean; // Whether to play subltle chime sound
  exampleWords?: any[]; // Array of example word objects with word and ipa properties
}

// Sub-component for rendering IPAPhonemeScenes
const IPAPhonemeScene = ({
  word,
  wordIPA,
  highlightedCharacter,
  containerStyle,
  sound = true,
  exampleWords = []
}: IPAPhonemeSceneProps) => {
  return (
    <>
      <div style={containerStyle}>
        {/* Play chime if sound prop is true */}
        {sound &&
          <Sequence durationInFrames={videoStore.getFrameForSeconds(0.5)}>
            <Audio src={staticFile("sounds/subtle-chime.mp3")} />
          </Sequence>
        }

        {/* Display word, IPA with highlight, and example words */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          {word && <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />}
          <StandardTextLetterHighlighted
            text={wordIPA}
            style={{ fontSize: 72, padding: "24px 35px" }}
            highlightedCharacter={highlightedCharacter}
          />
          {/* Render example words dynamically if available */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", marginTop: "20px" }}>
            {exampleWords.map((exWord, i) => (
              <div style={{ display: "flex", gap: 14, alignItems: "center" }} key={exWord.word}>
                <StandardText text={`${exWord.word}`} style={{ fontSize: 48, padding: "10px 20px" }} />
                <StandardText text={`->`} style={{ fontSize: 48, padding: "10px 30px" }} />
                <StandardTextLetterHighlighted
                  text={exWord.ipa}
                  highlightedFontSize={48}
                  style={{ fontSize: 48, padding: "10px 20px" }}
                  highlightedCharacter={highlightedCharacter}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
