import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { StandardText } from "../text/StandardText";

export const VowelScene = ({ voiceDuration }: { voiceDuration: number }) => {
  const slideDuration = 18; // 0.3s
  const slideStart = voiceDuration - slideDuration;
  const phonemeStart = voiceDuration;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <StandardText text="/e/" />
      <Audio src={staticFile("audios/02_this_is_the_vowel_sound.wav")} />

      {/* <Audio src={staticFile("sounds/click-sound.mp3")} /> */}
      <Sequence from={slideStart}>
        <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
      </Sequence>
      {/* <Sequence from={phonemeStart}>
        <Audio src={staticFile("sounds/chutter-click-494024.mp3")} />
      </Sequence> */}
    </AbsoluteFill>
  );
};