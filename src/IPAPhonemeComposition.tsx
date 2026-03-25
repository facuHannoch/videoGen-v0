import { AbsoluteFill, Img, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { videoStore } from "./state/videoStore";
import { StandardText } from "./videoCompositions/text/StandardText";
import { ScreenSweepShader } from "./videoCompositions/effects/WaveReveal";
import { BlackAbsoluteFill } from "./videoCompositions/fills/BlackAbsoluteFill";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";
import { IntroNoise } from "./videoCompositions/fills/IntroNoise";



export const IPAPhonemeVideoComposition = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Safe to access synchronously - store is guaranteed to be initialized
  const audios = videoStore.getAllAudios();
  if (audios.length === 0) {
    console.log("NO AUDIOS WERE LOADED")
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
    // audios[0]: "Mejoraré tu pronunciación en inglés" (es-MX) - Intro phrase
    [
      <>
        <StandardText text="Mejoraré tu pronunciación en inglés" style={{ fontSize: 72, padding: "24px 30px" }} />
      </>
    ],
    // audios[1]: "Este es el sonido /ʃ/." (es-MX) - Phoneme reveal
    [
      <>
        <ScreenSweepShader velocity={3} mode="reveal" />
        <Audio src={staticFile("sounds/mouse-click-double-hard.mp3")} volume={0.5} />
        <StandardText text={`/${phoneme}/`} style={{ fontSize: 108, padding: "24px 30px", }} />
      </>
    ],
    // audios[2]: "Lo puedes escuchar en palabras como" (en-US) - Intro to examples
    [
      <>
        <StandardText text={`/${phoneme}/`} style={{ fontSize: 108, padding: "24px 30px", opacity: 0.3 }} />
        <StandardText text="Lo puedes escuchar en palabras como" style={{ fontSize: 72, padding: "24px 30px", marginTop: 100 }} />
      </>
    ],
    // audios[3]: "she." (en-US, slow prosody) - First example
    [
      <>
        <StandardText text={wordsWithIpa[0].word} className="mb-4" style={{ fontSize: 120, padding: "20px 34px" }} />
        <StandardText text={wordsWithIpa[0].ipa} style={{ fontSize: 108, padding: "24px 30px", }} />
      </>
    ],
    // audios[4]: "ship." (en-US, slow prosody) - Second example
    [
      <>
        <StandardText text={wordsWithIpa[1].word} className="mb-4" style={{ fontSize: 120, padding: "20px 34px" }} />
        <StandardText text={wordsWithIpa[1].ipa} style={{ fontSize: 108, padding: "24px 30px", }} />
      </>
    ],
    // audios[5]: "shop." (en-US, slow prosody) - Third example
    [
      <>
        <StandardText text={wordsWithIpa[2].word} className="mb-4" style={{ fontSize: 120, padding: "20px 34px" }} />
        <StandardText text={wordsWithIpa[2].ipa} style={{ fontSize: 108, padding: "24px 30px", }} />
      </>
    ],
    // audios[6]: "Para hacer este sonido," (es-MX) - Transition to explanation
    [
      <>
        <StandardText text={`Para hacer este sonido,`} style={{ fontSize: 72, padding: "24px 30px", marginBottom: "30px" }} />
        <StandardText text={`/${phoneme}/`} style={{ fontSize: 108, padding: "24px 30px", opacity: 0.5 }} />
      </>
    ],
    // audios[7]: "redondea un poco los labios..." (en-US) - Explanation with Diagram
    [
      <>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
        <Img src={diagramImagePath} style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }} />
      </>
    ],
    // audios[8]: "¿Quieres sonar como un nativo? Mira el video en la descripcion" (es-MX) - Outro
    [
      <>
        {/* Cover shader to transition away from diagram */}
        <Sequence from={0} durationInFrames={fps}>
            <ScreenSweepShader velocity={2} mode="cover" />
        </Sequence>
        <StandardText text="¿Quieres sonar como un nativo?" style={{ fontSize: 60, padding: "24px 30px" }} />
        <StandardText text="Mira el video en la descripción" style={{ fontSize: 48, padding: "24px 30px", marginTop: 20 }} />
      </>
    ],
  ];


  return (
    <>
      <IntroNoise />

      {/* Main background music sequences - DO NOT CHANGE POSITION */}
      <Sequence from={0} durationInFrames={videoStore.framesToAudio(3) - videoStore.getFrameForSeconds(1)}>
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={volume}
        />
      </Sequence>

      {/* This global shutter sound is kept as per instructions not to change position of sounds,
          despite its potentially odd placement before audios[3].
          Another shutter sound for the diagram is included in scenes[7]. */}
      <Sequence from={videoStore.framesToAudio(3) - videoStore.getFrameForSeconds(1)}>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.8} />
      </Sequence>

      {/* Adjusted index for the last audio to ensure it's within bounds and represents total duration */}
      <Sequence from={videoStore.framesToAudio(audios.length) - videoStore.getFrameForSeconds(2)}>
        <Audio src={staticFile("music/vlog-hip-hop-boom-bach.mp3")} volume={.4} />
      </Sequence>
      {/* End main background music sequences */}


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
