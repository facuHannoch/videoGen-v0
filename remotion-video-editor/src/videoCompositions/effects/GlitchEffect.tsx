import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";

interface GlitchEffectProps {
  children: ReactNode;
  intensity?: number; // 0–1
}

// Deterministic per-frame hash — same seed always produces same value
function h(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const GlitchEffect: React.FC<GlitchEffectProps> = ({
  children,
  intensity = 0.7,
}) => {
  const frame = useCurrentFrame();

  const rgbOffset = (7 + h(frame * 3 + 1) * 13) * intensity;

  const b1Top = 10 + h(frame * 7  + 2) * 45;
  const b1H   =  4 + h(frame * 11 + 3) * 14;
  const b1Dx  = (h(frame * 5  + 4) - 0.5) * 52 * intensity;

  const b2Top = 58 + h(frame * 13 + 5) * 28;
  const b2H   =  3 + h(frame * 17 + 6) *  9;
  const b2Dx  = (h(frame * 19 + 7) - 0.5) * 36 * intensity;

  const ghost: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    mixBlendMode: "screen",
    opacity: 0.55 * intensity,
    zIndex: 1,
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* Red channel ghost — left */}
      <div style={{ ...ghost, transform: `translateX(${-rgbOffset}px)`, filter: "sepia(1) hue-rotate(-40deg) saturate(500%) brightness(1.1)" }}>
        {children}
      </div>

      {/* Blue channel ghost — right */}
      <div style={{ ...ghost, transform: `translateX(${rgbOffset}px)`, filter: "sepia(1) hue-rotate(160deg) saturate(500%) brightness(1.1)" }}>
        {children}
      </div>

      {/* Normal content */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {children}
      </div>

      {/* Horizontal band shift 1 */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        clipPath: `inset(${b1Top.toFixed(2)}% 0 ${Math.max(0, 100 - b1Top - b1H).toFixed(2)}% 0)`,
        transform: `translateX(${b1Dx.toFixed(2)}px)`,
      }}>
        {children}
      </div>

      {/* Horizontal band shift 2 */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        clipPath: `inset(${b2Top.toFixed(2)}% 0 ${Math.max(0, 100 - b2Top - b2H).toFixed(2)}% 0)`,
        transform: `translateX(${b2Dx.toFixed(2)}px)`,
      }}>
        {children}
      </div>

      {/* Pause icon */}
      <div style={{
        position: "absolute", top: 32, left: 32, zIndex: 10,
        display: "flex", gap: 15,
        padding: "10px 12px",
        borderRadius: 6,
        background: "rgba(0,0,0,0.45)",
        pointerEvents: "none",
      }}>
        <div style={{ width: 32, height: 115, borderRadius: 3, background: "rgba(255,255,255,0.9)" }} />
        <div style={{ width: 32, height: 115, borderRadius: 3, background: "rgba(255,255,255,0.9)" }} />
      </div>

    </div>
  );
};
