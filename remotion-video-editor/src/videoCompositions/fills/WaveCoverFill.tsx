import type {ReactNode} from "react";
import {AbsoluteFill} from "remotion";
import {WAVE_COVER_FILL} from "../effects/WaveReveal";

interface WaveCoverFillProps {
  children?: ReactNode;
}

export const WaveCoverFill = ({children}: WaveCoverFillProps) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: WAVE_COVER_FILL,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
