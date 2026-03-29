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
import airbagData from "./content.json"; // Assumes content.json is in the same directory and contains the JSON data

// Composition Component for Word Pronunciation
export const WordPronunciationVideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();

  // Guard against empty timelineClips
  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  // Find the required part from JSON based on content.json structure
  const wordPart = airbagData.parts.find(part => part.id === "part-1");
  if (!wordPart) {
      return <StandardText text="Word data not found" />
  }
  const wordData = JSON.parse(wordPart.content);
  
  const word = wordData.word;
  const wordIPA = wordData.ipa;
  // UPDATED: Language code from JSON part-2
  const languageCodePart = airbagData.parts.find(part => part.id === "part-2");
  const targetLanguage = languageCodePart ? languageCodePart.content : "en"; // Use "en" as fallback

  // Generate phoneme scenes dynamically from wordData.breakdown
  const generatePhonemeScenes = () => {
    return wordData.breakdown.flatMap((entry: any, index: number) => {
      const phoneme = entry.phoneme;
      // Get only the words from each entry for example words
      const explanationWords = entry.words.map((w: any) => w.word);
      // UPDATED: Dynamic text based on language and data structure
      const promptText = targetLanguage === "es" ? `Sonido / ${phoneme} /` : `Sound / ${phoneme} /`;

      return [
        [
          // phoneme explanation - dynamic sound/image loading
          <>
            <TopPrompt text={promptText} />
            <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
            <Img
              // Path dynamically constructed: images/phonemes-illustrative-images/[targetLanguage]/diagram-[phoneme].png
              src={staticFile(`images/phonemes-illustrative-images/${targetLanguage}/diagram-${phoneme}.png`)}
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
      // intro - 01_how_do_you_pronounce_this_word
      <>
        <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} startFrom={videoStore.getFrameForSeconds(0.1)} />

        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
        <Wave velocity={3} mode="reveal" />
        {/* UPDATED: English prompt */}
        <TopPrompt
          text="Turn sound on" 
          icon={<SpeakerOnIcon size={30} />}
        />
      </>
    ],
    [
      // gap - 1.5s
      <BlackAbsoluteFill>
        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
      </BlackAbsoluteFill>
    ],
    [
      // word pronunciation - 02_it_is_pronounced
      <>
        <BlackAbsoluteFill>
          <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />
        </BlackAbsoluteFill>

      </>
    ],
    [
      // transition to breakdown - 04_let-s_look_at_each_phoneme
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
    ...generatePhonemeScenes(), // Injects 10 scenes (explanation + words for 5 phonemes)
    [
      // final pronunciation 1 - 15_airbag
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      // final pronunciation 2 - 16_airbag
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      // outro - SFX - mouse-click-double-soft
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
      {/* Clock Ticking Sound and Visual - Defined based on specific timestamps */}
      <Sequence from={videoStore.getFrameForSeconds(1)} durationInFrames={videoStore.framesToAudio(1) + videoStore.getFrameForSeconds(1.5)}>
        <Audio src={staticFile("sounds/clock-ticking/double-medium-medium_soft.mp3")} volume={0.4} />
        <div style={{ position: "absolute", bottom: 500, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <TickingClock tickEveryFrames={8} size={280} />
        </div>
      </Sequence>

      {timelineClips.map((clip, sceneIndex) => {
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
      })}
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
  exampleWords?: string[]; // Array of example words for breakdown scenes
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
