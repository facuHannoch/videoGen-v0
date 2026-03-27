import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { StandardText } from "../text/StandardText";
import { Subtitle } from "../text/Subtitle";
import { introSubtitles } from "../subtitles";

export const IntroScene = () => {

  
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <StandardText text="Improve your english pronunciation" />
      <Audio src={staticFile("audios/01_i-ll_improve_your_english_pronunciation.wav")} />

      <Audio src={staticFile("sounds/bell-98033.mp3")} />

      {/* <Audio
        src={staticFile("music/tunetank-melodic-type-beat-349530.mp3")}
        volume={volume}
      /> */}

      <Sequence from={12}>
        <Subtitle text={introSubtitles[0].text} />
      </Sequence>

    </AbsoluteFill>
  );
};