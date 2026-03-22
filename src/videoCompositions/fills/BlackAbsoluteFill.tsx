import { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

interface BlackAbsoluteFillProps {
  children?: ReactNode;
}

export const BlackAbsoluteFill = ({ children }: BlackAbsoluteFillProps) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
