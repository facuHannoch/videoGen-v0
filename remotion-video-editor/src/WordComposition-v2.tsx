import { Img, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame } from "remotion";
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
import { ScreenView } from "./videoCompositions/ScreenView";
import screenKeyframesData from "./screen-keyframes.json";
import { ScreenEditorHUD } from "./videoCompositions/ScreenEditorHUD";
import { ScreenFill } from "./videoCompositions/fills/ScreenFill";
import { TickingClock } from "./videoCompositions/effects/TickingClock";
import { GlitchEffect } from "./videoCompositions/effects/GlitchEffect";

type ContentPart = {
  id: string;
  title: string;
  content: string;
};

type ContentData = {
  parts: ContentPart[];
};

// Composition Component for Word Pronunciation
export const WordPronunciationV2VideoComposition = () => {
  const timelineClips = videoStore.getTimelineClips();

  // Guard against empty timelineClips
  if (timelineClips.length === 0) {
    return <StandardText text="NO AUDIOS LOADED" />
  }

  // Find the required part from JSON based on content.json structure
  const contentData = airbagData as ContentData;
  // UPDATED: Correct JSON data part - points to "wall" now, based on content.json
  const jsonDataPart = contentData.parts.find((part: ContentPart) => part.title === "VIDEO_CONTENT");
  if (!jsonDataPart) {
    return <StandardText text="Word data not found" />
  }
  const sentence = contentData.parts.find((part: ContentPart) => part.title === "SENTENCE")?.content;
  const wordData = JSON.parse(jsonDataPart.content);

  const word = wordData.word;
  const wordIPA = wordData.ipa;

  // Language code from JSON part-2
  const targetLanguage = contentData.parts.find((part: ContentPart) => part.id === "part-2")?.content ?? "en";

  // Dynamic text based on language and data structure
  const promptTexts = {
    en: "Sound / PHONEME /",
    // ... add translations if needed
  };

  // Generate phoneme scenes dynamically from wordData.breakdown
  const generatePhonemeScenes = () => {
    return wordData.breakdown.flatMap((entry: any, index: number) => {
      const phoneme = entry.phoneme;

      // Get only the words from each entry for example words
      const explanationWords = entry.words;
      // Get the correct template text
      const template = promptTexts[targetLanguage] || promptTexts.en;
      // Replace the placeholder
      const promptText = template.replace('PHONEME', phoneme);
      // TARGET LANGUAGE SHOULD BE LOWERCASE
      // Correct character replacements for IPA symbols for image files if needed.
      const phonemeDiagramURL = `images/phonemes-illustrative-images/${targetLanguage.toLowerCase()}/diagram-${phoneme.replace(/ː/g, "").replace(/ə/g, "schwa")}.png`

      return [
        [
          // phoneme explanation - dynamic sound/image loading
          <>
            {/* <TopPrompt text={promptText} /> */}
            <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
            <ScreenView screenId="staticCenteredScreen"
              keyframes={screenKeyframesData.screens.staticCenteredScreen}>
              <ScreenFill>
                <Img
                  src={staticFile(phonemeDiagramURL)}
                  style={{ maxWidth: "95%", maxHeight: "95%", objectFit: "contain", position: 'absolute' }}
                />
              </ScreenFill>
            </ScreenView>

            {/* <IPAPhonemeScene
              key={`phoneme-explanation-${phoneme}-${index}`}
              wordIPA={wordIPA}
              highlightedCharacter={phoneme}
              containerStyle={{ position: 'absolute', top: 280 }}
              sound={false} // No sound for explanation scene in breakdown structure based on previous example
            /> */}
          </>
        ],
        [ // try it
          <>
            <ScreenView screenId="staticCenteredScreen"
              keyframes={screenKeyframesData.screens.staticCenteredScreen}>
              <ScreenFill>
                <StandardText text="Try it!" style={{ fontSize: 72, padding: "24px 30px" }} />
              </ScreenFill>
            </ScreenView>
          </>
        ],
        [<>
          <ScreenView screenId="staticCenteredScreen"
            keyframes={screenKeyframesData.screens.staticCenteredScreen}>
            <GlitchEffect intensity={0.2}>
              <ScreenFill>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", marginTop: "20px" }}>
                  {explanationWords.map((exWord: any, i: number) => (
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }} key={`${exWord.word}-${i}`}>
                      <StandardText text={`${exWord.word}`} style={{ fontSize: 96, padding: "10px 20px" }} />
                    </div>
                  ))}
                </div>

                {/* <StandardText text="CLOCK EFFECT" style={{ fontSize: 72, padding: "24px 30px" }} /> */}
              </ScreenFill>
            </GlitchEffect>
          </ScreenView>

          <ClockComponent />
        </>
        ],
        [
          <ScreenView screenId="staticCenteredScreen"
            keyframes={screenKeyframesData.screens.staticCenteredScreen}>
            {/* // phoneme words - dynamic scene index logic can be complex without pre-calculation */}
            <IPAPhonemeScene
              key={`phoneme-words-${phoneme}-${index}`}
              word={word} // Main word shown with breakdown
              wordIPA={wordIPA} // IPA transcription
              highlightedCharacter={phoneme} // Character to highlight
              exampleWords={explanationWords} // Passing the words array
            />
          </ScreenView>
        ]
      ]
    });
  };



  // Scene contents based on English language resources and timeline positions
  const scenes = [
    [ // opening line
      <>
      </>
    ],
    [ // gap
      <>
      </>
    ],
    [ // robot: try it + glitch effect & countdown
      <BlackAbsoluteFill>
        <div style={{ position: "absolute", top: 200, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <CountdownNumber />
        </div>
        <div style={{ position: "absolute", bottom: 400, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <TickingClock tickEveryFrames={videoStore.getFPS()} size={280} />
        </div>
      </BlackAbsoluteFill>

    ],
    [ // Ava: not
      <>
        {/* <TopPrompt text="Sound /m/" /> */}
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <ScreenFill>
            <StandardText text={word} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
            <StandardText text={wordIPA} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
          </ScreenFill>
        </ScreenView>
      </>
    ],
    [ // glitch effect + countdown
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          {/* <GlitchEffect> */}
          <ScreenFill>
            <StandardText text="Let's look at each phoneme" style={{ fontSize: 96, padding: "10px 20px", }} />
          </ScreenFill>
          {/* </GlitchEffect> */}
        </ScreenView>
      </>
    ],
    ...generatePhonemeScenes(),
    [ // Say the full word
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <ScreenFill>
            <StandardText text="Say the full word" style={{ fontSize: 96, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView>
      </>
    ],
    [ // gap for word
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <GlitchEffect>
            {/* <StandardText text="CLOCK EFFECT" style={{ fontSize: 96, padding: "10px 20px", }} /> */}
            <ScreenFill>
              <StandardText text={word} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
              <StandardText text={wordIPA} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
            </ScreenFill>
          </GlitchEffect>
        </ScreenView>
        <ClockComponent />
      </>
    ],
    [ // Ava: [word]
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <ScreenFill>
            <StandardText text={word} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
            <StandardText text={wordIPA} style={{ fontSize: 96, padding: "10px 20px", margin: "10px 20px" }} />
          </ScreenFill>
        </ScreenView>
      </>
    ],
    [ // Say the sentence
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <ScreenFill>
            <StandardText text={sentence} style={{ fontSize: 96, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView>
      </>
    ],
    [ // gap for sentence
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <GlitchEffect>
            <ScreenFill>
              <StandardText text={sentence} style={{ fontSize: 96, padding: "10px 20px" }} />
              {/* <StandardText text="CLOCK EFFECT" style={{ fontSize: 96, padding: "10px 20px", }} /> */}
            </ScreenFill>
          </GlitchEffect>
        </ScreenView>
        <ClockComponent />

      </>
    ],
    [ // Ava: [sentence]
      <>
        <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <ScreenFill>
            <StandardText text={sentence} style={{ fontSize: 96, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView>
      </>
    ],
    [ // gap
      <>
        <ScreenView screenId="staticCenteredScreenToMain3" keyframes={screenKeyframesData.screens.staticCenteredScreenToMain3}>
          <ScreenFill>
            <StandardText text="Want to practice?" style={{ fontSize: 96, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView>
        {/* <Sequence durationInFrames={videoStore.getAudioDurationFrames("audios/17_i_am_not_ready_yet.wav")! - videoStore.getFrameForSeconds(0.4)}>
          <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
            <ScreenFill>
              <StandardText text="{turn off}" style={{ fontSize: 240, padding: "10px 20px", }} />
            </ScreenFill>
          </ScreenView>
        </Sequence> */}
      </>
    ],
    [ // robot: now do it for real
      <>
        <TopPrompt text={`ipacoach.com/en/practice/${word}`} />
        {/* <ScreenView screenId="staticCTAScreen" keyframes={screenKeyframesData.screens.staticCTAScreen}>
          <ScreenFill>
            <StandardText text="for free" style={{ fontSize: 240, padding: "10px 20px", }} />
            <StandardText text="RECORDING" style={{ fontSize: 240, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView> */}
      </>
    ],
    [ // robot: practice
      <>
        <TopPrompt text={`ipacoach.com/en/practice/${word}`} />
        {/* <ScreenView screenId="staticCTAScreen" keyframes={screenKeyframesData.screens.staticCTAScreen}>
          <ScreenFill>
            <StandardText text="practice now for free" style={{ fontSize: 240, padding: "10px 20px", }} />
            <StandardText text="RECORDING" style={{ fontSize: 240, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView> */}
      </>
    ],

  ];

  // const clockvideoStore.framesToAudio(1) + videoStore.getFrameForSeconds(3)

  const fadeDuration = videoStore.getFPS()
  const volume = interpolate(
    useCurrentFrame(),
    [0, fadeDuration],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );

  const scene1Duration = videoStore.getFrameForSeconds(5)
  const scene2Duration = videoStore.getFrameForSeconds(3)
  const staticScreenStart = scene1Duration + scene2Duration - videoStore.getFrameForSeconds(0.2)
  const staticScreenDuration = videoStore.getTotalDurationFrames() - staticScreenStart - videoStore.getFrameForSeconds(4.8)


  return (
    <>

      {/* <Series>
        <Series.Sequence durationInFrames={videoStore.getFrameForSeconds(5)}>
          <OffthreadVideo
            src={staticFile("scenes/scene-1.mp4")}
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
          />

        </Series.Sequence>
        <Series.Sequence durationInFrames={videoStore.getFrameForSeconds(5)}>
          <OffthreadVideo
            src={staticFile("scenes/scene-2.mp4")}
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
          />
        </Series.Sequence>
      </Series> */}

      <ScreenEditorHUD />

      <Sequence durationInFrames={scene1Duration}>
        <OffthreadVideo
          src={staticFile("scenes/scene-1.mp4")}
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
        />
        <ScreenView screenId="main1" keyframes={screenKeyframesData.screens.main1}>
          {/* <TopPrompt text="Sound /m/" /> */}
          <ScreenFill>
            <StandardText text={word} style={{ fontSize: 120, padding: "10px 20px", }} />
          </ScreenFill>
        </ScreenView>

      </Sequence>

      <Sequence from={scene1Duration - videoStore.getFrameForSeconds(0.2)} durationInFrames={scene2Duration}>
        <OffthreadVideo
          src={staticFile("scenes/scene-2.mp4")}
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
        />
        <ScreenView screenId="main2" keyframes={screenKeyframesData.screens.main2}>
          <GlitchEffect>
            <ScreenFill>
              <StandardText text={word} style={{ fontSize: 124, padding: "10px 20px", }} />
              {/* <StandardText text="CLOCK EFFECT" style={{ fontSize: 124, padding: "10px 20px", }} /> */}
            </ScreenFill>
          </GlitchEffect>
          {/* TODO: Load this dinamically */}
          {/* <Audio src={staticFile("audios/02_first-_try_it.wav")} volume={volume} /> */}
        </ScreenView>
      </Sequence>

      <Sequence from={staticScreenStart - videoStore.getFrameForSeconds(0.2)} durationInFrames={staticScreenDuration + videoStore.getFrameForSeconds(0.4)}>
        <Img src={staticFile("images/snapshot3.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }} />
        {/* <ScreenView screenId="staticCenteredScreen" keyframes={screenKeyframesData.screens.staticCenteredScreen}>
          <BlackAbsoluteFill>
            <StandardText text="Sound /m/" style={{ fontSize: 240, padding: "10px 20px", position: "absolute", top: 100 }} />
          </BlackAbsoluteFill>
        </ScreenView> */}
      </Sequence>


      <Sequence from={videoStore.getTotalDurationFrames() - videoStore.getFrameForSeconds(4.8)} durationInFrames={videoStore.getFrameForSeconds(4.8)}>
        <OffthreadVideo
          src={staticFile("scenes/scene-3.mp4")}
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
        />
        <ScreenView screenId="main3" keyframes={screenKeyframesData.screens.main3}>
          {/* <TopPrompt text="Sound /m/" /> */}
          <OffthreadVideo
            src={staticFile("videos/word-page-demonstrastion-5s.mp4")}
            style={{ position: "absolute", width: "120%", height: "100%", objectFit: "fill", opacity: 1 }}
          />
        </ScreenView>
      </Sequence>


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
          // if (!src) {
          //   return null;
          // }

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
      <ScreenFill>
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
              <div style={{ display: "flex", gap: 14, alignItems: "center" }} key={`${exWord.word}-${i}`}>
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
      </ScreenFill>
    </>
  );
};


const CountdownNumber = () => {
  const frame = useCurrentFrame();
  const elapsedSeconds = Math.floor(frame / videoStore.getFPS());
  const remainingSeconds = Math.max(1, 3 - elapsedSeconds);

  return <StandardText text={`${remainingSeconds}`} style={{ fontSize: 104 }} />;
};


const ClockComponent = () => <>
  <BlackAbsoluteFill>
    <Audio src={staticFile("sounds/clock-ticking/down-soft.mp3")} volume={0.8} />
    <div style={{ position: "absolute", top: 200, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
      <CountdownNumber />
    </div>
    <div style={{ position: "absolute", bottom: 400, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
      <TickingClock tickEveryFrames={videoStore.getFPS()} size={280} />
    </div>
  </BlackAbsoluteFill>
</>