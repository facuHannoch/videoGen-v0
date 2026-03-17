import { AbsoluteFill, getStaticFiles, Html5Audio, Img, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { IntroScene } from "./videoCompositions/scenes/IntroScene";
import { VowelScene } from "./videoCompositions/scenes/VowelScene";
// import { useCurrentFrame as useFrame } from "remotion";
import { Audio } from "@remotion/media";
import { videoStore } from "./storage/videoStore";
import { StandardText } from "./videoCompositions/text/StandardText";
import { Subtitle } from "./videoCompositions/text/Subtitle";
import { BlackAbsoluteFill } from "./videoCompositions/fills/BlackAbsoluteFill";
import { OneWordCaption } from "./videoCompositions/text/subtitles/OneWordCaption";
import { soundStore } from "./storage/soundStore";


export const VideoComposition = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Safe to access synchronously - store is guaranteed to be initialized
  const audios = videoStore.getAllAudios();


  const fadeDuration = fps;

  const volume = interpolate(
    frame,
    [0, fadeDuration],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );
  const chutterClickFrames =
    soundStore.getSoundDurationFrames("sounds/chutter-click-494024.mp3") ??
    videoStore.getFrameForSeconds(1);

  const phoneme = "p"
  // const words = ["pen", "pie", "cap"]
  const words = [{
    "word": "pen",
    "ipa": "/pɛn/"
  }, {
    "word": "pie",
    "ipa": "/paɪ/"
  }, {
    "word": "cap",
    "ipa": "/kæp/"
  }]


  const scenes = [
    [
      <>
        <StandardText text={`Improve your english pronunciation`} />
        <Audio src={staticFile("sounds/bell-98033.mp3")}  volume={0.4}/>
        {/* <Sequence from={12}>
          <Subtitle text={introSubtitles[0].text} />
        </Sequence> */}

      </>
    ],
    [
      <>
        <Audio src={staticFile("sounds/mouse-click-sfx-478755.mp3")} />
        {/* <Sequence from={Math.max(audios[0].durationInFrames - chutterClickFrames, 0)}> */}
        <StandardText text={phoneme} style={{ fontSize: 108, padding: "24px 30px", }} />
        <Sequence from={audios[0].durationInFrames}>
          <Audio src={staticFile("sounds/chutter-click-494024.mp3")} volume={0.4} />
        </Sequence>
      </>
    ],
    [
      <>
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
      </>
    ],
    [
      <>
        <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
        <Img src={staticFile("images/diagram.png")} style={{ marginBottom: 240 }} />
      </>
    ],
    [
      <>
        <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
      </>
    ],
  ]


  return (
    <>

      <Sequence from={0} durationInFrames={audios[0].durationInFrames + audios[1].durationInFrames}>
        <Audio
          src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
          volume={volume}
        />
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



