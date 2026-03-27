import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

export const LightSweep = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const start = fps * 0.15;
  const end = fps * 0.9;

  const travel = interpolate(frame, [start, end], [-width * 0.8, width * 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacityIn = interpolate(frame, [start, start + fps * 0.12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacityOut = interpolate(frame, [end - fps * 0.18, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(opacityIn, opacityOut) * 0.38;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -height * 0.12,
          left: travel,
          width: width * 0.42,
          height: height * 1.25,
          transform: "rotate(18deg)",
          transformOrigin: "center",
          opacity,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 24%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.08) 76%, rgba(255,255,255,0) 100%)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -height * 0.04,
          left: travel + width * 0.02,
          width: width * 0.12,
          height: height * 1.08,
          transform: "rotate(18deg)",
          transformOrigin: "center",
          opacity: opacity * 0.8,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(191,219,254,0.36) 50%, rgba(255,255,255,0) 100%)",
          filter: "blur(8px)",
        }}
      />
    </AbsoluteFill>
  );
};
