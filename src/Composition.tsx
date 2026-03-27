import { noise3D } from "@remotion/noise";
import { AbsoluteFill, Img, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { videoStore } from "./storage/videoStore";
import { StandardText } from "./videoCompositions/text/StandardText";
import { ZIndexTitle } from "./videoCompositions/text/IntroTitle";
import { TopPrompt } from "./videoCompositions/text/TopPrompt";
import { Wave } from "./videoCompositions/effects/WaveReveal";
import { BlackAbsoluteFill } from "./videoCompositions/fills/BlackAbsoluteFill";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";
import { WaveCoverFill } from "./videoCompositions/fills/WaveCoverFill";

const IntroNoise = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const cols = 18;
  const rows = 32;
  const overscan = 540;
  const speed = 0.014;
  const maxOffset = 95;

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #242e4600 0%, #383f4e00 48%, #ffffff00 100%)",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 18%, rgba(78, 96, 153, 0.22), transparent 28%), radial-gradient(circle at 78% 72%, rgba(52, 66, 126, 0.24), transparent 30%)",
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {new Array(cols).fill(true).map((_, i) =>
          new Array(rows).fill(true).map((__, j) => {
            const x = i * ((width + overscan) / cols) - overscan / 2;
            const y = j * ((height + overscan) / rows) - overscan / 2;
            const px = i / cols;
            const py = j / rows;
            const dx = noise3D("intro-x", px, py, frame * speed) * maxOffset;
            const dy = noise3D("intro-y", px, py, frame * speed) * maxOffset;
            const opacity = interpolate(
              noise3D("intro-opacity", px, py, frame * speed),
              [-1, 1],
              [0.08, 0.55]
            );

            return (
              // <rect
              //   key={`${i}-${j}`}
              //   cx={x + dx}
              //   cy={y + dy}
              //   r={5.0}
              //   fill="#ffffff9a"
              //   opacity={opacity}
              // />
              <circle
                key={`${i}-${j}`}
                cx={x + dx}
                cy={y + dy}
                r={5.0}
                fill="#ffffff9a"
                opacity={opacity}
              />
            );
          })
        )}
      </svg>
    </AbsoluteFill>
  );
};


export const VideoComposition = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Safe to access synchronously - store is guaranteed to be initialized
  const audios = videoStore.getAllAudios();
  if (audios.length === 0) {
    console.log("NO AUDIOS WERE LOADED")
  }


  const fadeDuration = fps;

  const volume = interpolate(
    frame,
    [0, fadeDuration],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );
  // const chutterClickFrames =
  //   soundStore.getSoundDurationFrames("sounds/chutter-click-494024.mp3") ??
  //   videoStore.getFrameForSeconds(1);

  const phoneme = "g"
  // const words = ["pen", "pie", "cap"]
  const words = [{
    "word": "go",
    "ipa": "/ɡoʊ/"
  }, {
    "word": "get",
    "ipa": "/ɡɛt/"
  }, {
    "word": "bag",
    "ipa": "/bæɡ/"
  }]


  const scenes = [
    [
      <>
        <Wave velocity={3} mode="reveal" />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <TopPrompt
            text="Activate the sound to hear"
            icon={
              <svg width="30" height="30" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M3 7.25H5.75L9.1 4.5V13.5L5.75 10.75H3V7.25Z"
                  fill="currentColor"
                />
                <path
                  d="M11.35 6.1C12.35 6.95 12.95 7.95 12.95 9C12.95 10.05 12.35 11.05 11.35 11.9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M12.95 4.45C14.45 5.7 15.3 7.3 15.3 9C15.3 10.7 14.45 12.3 12.95 13.55"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <ZIndexTitle text="Improve your english pronunciation" />
        </AbsoluteFill>
        <Audio src={staticFile("sounds/good-middle_large-notification.mp3")} volume={0.4} />
        {/* <Sequence from={12}>
          <Subtitle text={introSubtitles[0].text} />
        </Sequence> */}

      </>
    ],
    [
      <>
        <Audio src={staticFile("sounds/mouse-click-double-hard.mp3")} volume={0.5} />
        {/* <Sequence from={Math.max(audios[0].durationInFrames - chutterClickFrames, 0)}> */}
        <StandardText text={phoneme} style={{ fontSize: 108, padding: "24px 30px", }} />
        <Sequence from={audios[0].durationInFrames}>
          <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.4} />
        </Sequence>
      </>
    ],
    [
      <>
        <StandardText text={phoneme} style={{ fontSize: 108, padding: "24px 30px", }} />
      </>
    ],
    ...words.map(word => <>
      <StandardText text={word.word} className="mb-4" style={{ fontSize: 120, padding: "20px 34px" }} />
      <StandardText text={word.ipa} style={{ fontSize: 108, padding: "24px 30px", }} />
    </>),
    // [
    //   <>
    //     <StandardText text={words[0].word} />
    //     <StandardText text={words[0].ipa} />
    //   </>
    // ],
    // [
    //   <>
    //   </>
    // ],
    // [
    //   <>
    //   </>
    // ],
    [
      <>
        <Audio src={staticFile("sounds/shutter-sound-medium.m4a")} volume={0.4} />
        <Img src={staticFile("images/diagram.jpg")} style={{ marginBottom: 240 }} />
      </>
    ],
    [
      <>
        <Img src={staticFile("images/diagram.jpg")} style={{ marginBottom: 240 }} />
      </>
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
    ],
  ]


  return (
    <>
      <IntroNoise />

      <Sequence from={0} durationInFrames={audios[0].durationInFrames + audios[1].durationInFrames}>
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={volume}
        />
      </Sequence>

      <Sequence from={videoStore.framesToAudio(9) - videoStore.getFrameForSeconds(2)}>
        <Audio src={staticFile("music/vlog-hip-hop-boom-bach.mp3")} volume={.4} />
      </Sequence>


      <Series>
        {audios.map((audio, i) => {
          return (
            <Series.Sequence name={audio.src.split("/")[1]} key={audio.src} durationInFrames={audio.durationInFrames}>
              <BlackAbsoluteFill>
                {/* <StandardText text={`Scene ${i}`} /> */}
                <Audio src={staticFile(audio.src)} volume={1} />
                {scenes[i]}

                <OneWordCaption wordTimings={audio.wordTimings} />
              </BlackAbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>


      {/* <IntroScene /> */}
      {/* <Sequence from={introDuration} durationInFrames={vowelDuration}>
        <VowelScene voiceDuration={vowelDuration} />
      </Sequence> */}

      {/* <Sequence from={0} durationInFrames={introDuration + vowelDuration - videoStore.getFrameForSeconds(0.7)}>
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={volume}
        />
      </Sequence>

      <Sequence from={0} durationInFrames={introDuration}>
        <BlackAbsoluteFill>
          <Audio src={staticFile("audios/01_i-ll_improve_your_english_pronunciation.wav")} />
          <Audio src={staticFile("sounds/bell-98033.mp3")} />

          <StandardText text="Scene 1" />

          <Sequence from={12}>
            <Subtitle text="{introSubtitles[0].text}" />
          </Sequence>
        </BlackAbsoluteFill>

      </Sequence>

      <Sequence from={introDuration} durationInFrames={vowelDuration}>
        <BlackAbsoluteFill>
          <StandardText text="Scene 2" />
          <Audio src={staticFile("audios/02_this_is_the_vowel_sound.wav")} />

          <Sequence from={vowelDuration - videoStore.getFrameForSeconds(1)}>
            <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
          </Sequence>
        </BlackAbsoluteFill>
      </Sequence>

      <Sequence from={introDuration} durationInFrames={vowelDuration}>
        <BlackAbsoluteFill>
          <StandardText text="Scene 2" />
          <Audio src={staticFile("audios/02_this_is_the_vowel_sound.wav")} />

          <Sequence from={vowelDuration - videoStore.getFrameForSeconds(1)}>
            <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
          </Sequence>
        </BlackAbsoluteFill>
      </Sequence> */}

    </>
  );
};
