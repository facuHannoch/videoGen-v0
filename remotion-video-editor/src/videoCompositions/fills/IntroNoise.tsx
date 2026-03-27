import { noise3D } from "@remotion/noise";
import { AbsoluteFill, Img, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";


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


export { IntroNoise }