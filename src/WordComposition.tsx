import { AbsoluteFill, Img, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { videoStore } from "./state/videoStore";
import { StandardText } from "./videoCompositions/text/StandardText";
import { ScreenSweepShader } from "./videoCompositions/effects/WaveReveal";
import { BlackAbsoluteFill } from "./videoCompositions/fills/BlackAbsoluteFill";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";
import { IntroNoise } from "./videoCompositions/fills/IntroNoise";


export const WordPronunciationVideoComposition = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Safe to access synchronously - store is guaranteed to be initialized
  const audios = videoStore.getAllAudios();
  if (audios.length === 0) {
    console.log("NO AUDIOS WERE LOADED")
    return <StandardText text="NO AUDIOS LOADED" />
  }

  console.log(audios)
  const fadeDuration = fps;

  const volume = interpolate(
    frame,
    [0, fadeDuration],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );

  // --- START OF MODIFICATIONS ---
  // Update the phoneme and example words with correct IPA for /ʃ/
  const phoneme = "ʃ";
  const wordsWithIpa = [
    { "word": "she", "ipa": "/ʃiː/" },
    { "word": "ship", "ipa": "/ʃɪp/" },
    { "word": "shop", "ipa": "/ʃɒp/" }
  ];
  // The diagram image path is updated to match the generated_resources_json path
  const diagramImagePath = staticFile("images/diagram.jpeg");
  // --- END OF MODIFICATIONS ---

  // Re-aligned scenes to match the 9 audio pieces from the script_xml.
  const scenes = [
    // audios[0]
    [
      <>
      </>
    ],
    // audios[1]
    [
      <>
      </>
    ],
    // audios[2]
    [
      <>
      </>
    ],
    // audios[3]
    [
      <>
      </>
    ],
    // audios[4]
    [
      <>
      </>
    ],
    // audios[5]
    [
      <>
      </>
    ],
    // audios[6]
    [
      <>
      </>
    ],
    // audios[7]
    [
      <>
      </>
    ],
    // audios[8]
    [
      <>
      </>
    ],
  ];


  return (
    <>
      <IntroNoise />

      <Series>
        {audios.map((audio, i) => {
          return (
            <Series.Sequence name={audio.src.split("/").pop()} key={audio.src} durationInFrames={audio.durationInFrames}>
              <BlackAbsoluteFill>
                <Audio src={staticFile(audio.src)} volume={1} />
                {/* Render the scene content corresponding to the current audio piece */}
                {scenes[i]}

                <OneWordCaption wordTimings={audio.wordTimings} />
              </BlackAbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>
    </>
  );
};
