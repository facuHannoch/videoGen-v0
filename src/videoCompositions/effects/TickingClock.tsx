import { interpolate, useCurrentFrame } from "remotion";

interface TickingClockProps {
  size?: number;
  tickEveryFrames?: number;
  className?: string;
}

export const TickingClock = ({
  size = 120,
  tickEveryFrames = 8,
  className,
}: TickingClockProps) => {
  const frame = useCurrentFrame();
  const safeTickEveryFrames = Math.max(1, tickEveryFrames);
  const tickCount = Math.floor(frame / safeTickEveryFrames);
  const frameInTick = frame % safeTickEveryFrames;

  const secondHandAngle = (tickCount % 60) * 6;
  const minuteHandAngle = (tickCount % 360) * 0.5;
  const tickPulse = interpolate(
    frameInTick,
    [0, Math.min(2, safeTickEveryFrames), safeTickEveryFrames],
    [1.04, 1, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const center = size / 2;
  
  // Proportional dimensions based on 120px default
  const tickWidth = size * 0.025;
  const tickHeight = size * 0.1;
  const tickTop = size * 0.067;
  const tickTranslateY = size * (-0.0167);
  const minuteHandHeight = size * 0.2;
  const secondHandHeight = size * 0.283;
  const centerDotSize = size * 0.083;
  const centerDotOffset = size * 0.042;
  const handWidth = size * 0.017;
  const handMinuteWidth = size * 0.0167;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${size * 0.033}px solid rgba(255,255,255,0.95)`,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        boxShadow: `0 ${size * 0.067}px ${size * 0.183}px rgba(0,0,0,0.35)`,
        transform: `scale(${tickPulse})`,
        transformOrigin: "center",
        position: "relative",
      }}
    >
      {[0, 1, 2, 3].map((index) => {
        const quarter = index * 90;

        return (
          <div
            key={quarter}
            style={{
              position: "absolute",
              left: center - tickWidth / 2,
              top: tickTop,
              width: tickWidth,
              height: tickHeight,
              borderRadius: 999,
              backgroundColor: "rgba(248,250,252,0.95)",
              transform: `rotate(${quarter}deg) translateY(${tickTranslateY}px)`,
              transformOrigin: `${tickWidth / 2}px ${center - tickHeight / 2}px`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: center - handMinuteWidth / 2,
          top: center - minuteHandHeight,
          width: handMinuteWidth,
          height: minuteHandHeight,
          borderRadius: 999,
          backgroundColor: "#e2e8f0",
          transform: `rotate(${minuteHandAngle}deg)`,
          transformOrigin: `${handMinuteWidth / 2}px ${minuteHandHeight}px`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: center - handWidth / 2,
          top: center - secondHandHeight,
          width: handWidth,
          height: secondHandHeight,
          borderRadius: 999,
          backgroundColor: "#60a5fa",
          transform: `rotate(${secondHandAngle}deg)`,
          transformOrigin: `${handWidth / 2}px ${secondHandHeight}px`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: center - centerDotOffset,
          top: center - centerDotOffset,
          width: centerDotSize,
          height: centerDotSize,
          borderRadius: "50%",
          backgroundColor: "#f8fafc",
        }}
      />
    </div>
  );
};
