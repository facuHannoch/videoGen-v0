import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import type {ReactNode} from "react";

interface TopPromptProps {
  text: string;
  icon?: ReactNode;
}

export const TopPrompt = ({text, icon}: TopPromptProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const opacity = interpolate(frame, [4, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [4, 14], [-18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [4, 14], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shimmer = interpolate(frame, [10, fps * 0.9], [0.68, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 144,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        zIndex: 3,
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 22px",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.18)",
        background: `linear-gradient(180deg, rgba(17,24,39,${0.74 * shimmer}) 0%, rgba(31,41,55,${0.86 * shimmer}) 100%)`,
        boxShadow: "0 10px 24px rgba(2,6,23,0.18)",
        color: "#f8fafc",
        opacity,
        backdropFilter: "blur(8px)",
      }}
    >
      {icon ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e5e7eb",
            fontSize: 52,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      ) : null}
      <span
        style={{
          fontSize: 52,
          fontWeight: 600,
          letterSpacing: -0.6,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
};
