import { Img, Sequence, staticFile, useCurrentFrame } from "remotion";
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

type ContentPart = {
  id: string;
  content: string;
};

type ContentData = {
  parts: ContentPart[];
};

const CountdownNumber = () => {
  const frame = useCurrentFrame();
  const elapsedSeconds = Math.floor(frame / videoStore.getFPS());
  const remainingSeconds = Math.max(1, 3 - elapsedSeconds);

  return <StandardText text={`${remainingSeconds}`} style={{ fontSize: 104 }} />;
};

// Composition Component for Word Pronunciation
export const WordPronunciationVideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();

  // Guard against empty timelineClips
  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  // Find the required part from JSON based on content.json structure
  const contentData = airbagData as ContentData;
  const wordPart = contentData.parts.find((part: ContentPart) => part.id === "part-2");
  if (!wordPart) {
    return <StandardText text="Word data not found" />
  }
  const wordData = JSON.parse(wordPart.content);

  const word = wordData.word;
  const wordIPA = wordData.ipa;
  
  // UPDATED: Language code from JSON part-3
  const languageCodePart = contentData.parts.find((part: ContentPart) => part.id === "part-3");
  const targetLanguage = languageCodePart ? languageCodePart.content : "en"; // Use "en" as fallback
  
  // Generate phoneme scenes dynamically from wordData.breakdown
  const generatePhonemeScenes = () => {
    return wordData.breakdown.flatMap((entry: any, index: number) => {
      console.log(entry)
      // Standardize flap T for file matching: t̬ -> t_flap. However, based on the prompt diagram-PHONEME_IPA_SYMBOL.png, the IPA symbol is likely used. Let's assume the diagram uses 't' or 't_flap' rather than the IPA with diacritic in the filename. Given typical filenaming conventions, it might be safer to use a more standardized representation for the filename if necessary, but the prompt says to use PHONEME_IPA_SYMBOL. So we use the IPA symbol verbatim.

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
              // UPDATED: Standardizing filenames based on typical conventions, potentially replacing diacritics if needed for file systems, but prompt says phoneme IPA symbol. Let's try and use the literal character.
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
      // intro - 01_try_to_pronounce_this_word.wav
      <>
        <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} />

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
      // gap - 3s
      <BlackAbsoluteFill>
        <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
      </BlackAbsoluteFill>
    ],
    [
      // word pronunciation - 02_Wednesday.wav
      <>
        <BlackAbsoluteFill>
          <StandardText text={wordIPA} style={{ fontSize: 72, padding: "24px 30px" }} />
        </BlackAbsoluteFill>

      </>
    ],
    [
      // transition to breakdown - 03_veamos_cada_fonema.wav
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
      // final pronunciation 1 - 18_wednesday.wav
      <StandardText text={word} style={{ fontSize: 72, padding: "24px 30px" }} />
    ],
    [
      // final pronunciation 2 - 19_wednesday.wav
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

  // const clockvideoStore.framesToAudio(1) + videoStore.getFrameForSeconds(3)

  const shutterDuration = videoStore.getFrameForSeconds(0.2)

  return (
    <>
      <IntroNoise />

      {/* <Sequence from={shutterDuration*2} durationInFrames={videoStore.framesToAudio(2) + videoStore.getFrameForSeconds(3) - shutterDuration*2} >
        <Audio src={staticFile("music/tension-pulse-1.mp3")} volume={0.15} />
      </Sequence> */}
      {/* <Audio src={staticFile("music/dark-pop.m4a")} volume={0.1} /> */}

      <Sequence from={videoStore.getFrameForSeconds(1)} durationInFrames={videoStore.getFrameForSeconds(4)}>
        {/* Note that this has the following logic: we want to start 1 second after the second 0, and we want the scene to last until the 2nd audio (audio[1]). videoStore.framesToAudio does not account for non-audio, so we have to manually add the duration of the sound scene in between (1.5 seconds) */}
        <Audio src={staticFile("music/tension-pulse-1.mp3")} volume={0.2} />

        <Audio src={staticFile("sounds/clock-ticking/double-medium-medium_soft.mp3")} volume={0.4} />
        <div style={{ position: "absolute", top: 500, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <CountdownNumber />
        </div>
        <div style={{ position: "absolute", bottom: 500, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <TickingClock tickEveryFrames={videoStore.getFPS()} size={280} />
        </div>

      </Sequence>
      <Sequence from={videoStore.framesToAudio(2) + videoStore.getFrameForSeconds(3) - shutterDuration} durationInFrames={videoStore.getFrameForSeconds(1)}>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
      </Sequence >

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
