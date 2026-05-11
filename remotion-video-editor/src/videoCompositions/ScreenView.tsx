import { useCallback, useRef, useState } from "react";
import { getRemotionEnvironment, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { computeMatrix3d, Corners, Point } from "../utils/computeMatrix3d";

export type { Corners, Point };

export interface ScreenKeyframe {
  frame: number;
  corners: Corners;
}

interface ScreenViewProps {
  // Identifies which screen's keyframes to update when dragging.
  // Must match a key in screen-keyframes.json > screens.
  screenId: string;
  keyframes: ScreenKeyframe[];
  // Natural dimensions of the content canvas children render into.
  // Defaults to the full video dimensions if omitted.
  contentWidth?: number;
  contentHeight?: number;
  children?: React.ReactNode;
}

type SaveStatus = "saving" | "saved" | "error" | null;

const KEYFRAME_SERVER = "http://localhost:3001";

function interpolateCorners(frame: number, keyframes: ScreenKeyframe[]): Corners {
  const frames = keyframes.map((k) => k.frame);
  const opts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  return {
    tl: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.tl.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.tl.y), opts) },
    tr: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.tr.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.tr.y), opts) },
    br: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.br.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.br.y), opts) },
    bl: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.bl.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.bl.y), opts) },
  };
}

function roundCorners(c: Corners): Corners {
  const r = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
  return { tl: r(c.tl), tr: r(c.tr), br: r(c.br), bl: r(c.bl) };
}

export const ScreenView: React.FC<ScreenViewProps> = ({
  screenId,
  keyframes,
  contentWidth: contentWidthProp,
  contentHeight: contentHeightProp,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth, height: videoHeight } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();

  const contentWidth = contentWidthProp ?? videoWidth;
  const contentHeight = contentHeightProp ?? videoHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const [devCorners, setDevCorners] = useState<Corners | null>(null);
  const [dragging, setDragging] = useState<{
    corner: keyof Corners;
    startScreen: Point;
    startCorner: Point;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);

  const baseCorners = interpolateCorners(frame, keyframes);
  const corners = devCorners ?? baseCorners;
  const matrix = computeMatrix3d(contentWidth, contentHeight, corners);

  const getScale = useCallback(() => {
    if (!containerRef.current) return 1;
    return containerRef.current.getBoundingClientRect().width / videoWidth;
  }, [videoWidth]);

  const handlePointerDown = useCallback(
    (corner: keyof Corners, e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging({ corner, startScreen: { x: e.clientX, y: e.clientY }, startCorner: { ...corners[corner] } });
    },
    [corners]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const scale = getScale();
      const dx = (e.clientX - dragging.startScreen.x) / scale;
      const dy = (e.clientY - dragging.startScreen.y) / scale;
      setDevCorners((prev) => ({
        ...(prev ?? baseCorners),
        [dragging.corner]: { x: dragging.startCorner.x + dx, y: dragging.startCorner.y + dy },
      }));
    },
    [dragging, getScale, baseCorners]
  );

  const handlePointerUp = useCallback(async () => {
    setDragging(null);
    if (!devCorners) return;

    const rounded = roundCorners(devCorners);
    setSaveStatus("saving");

    try {
      const res = await fetch(`${KEYFRAME_SERVER}/keyframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId, frame, corners: rounded }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      // Remotion hot-reloads the JSON; clear devCorners so new keyframe values take over
      setTimeout(() => {
        setDevCorners(null);
        setSaveStatus(null);
      }, 700);
    } catch (e) {
      console.error("[ScreenView] keyframe save failed:", e);
      setSaveStatus("error");
    }
  }, [devCorners, screenId, frame]);

  const showHandles = !isRendering;

  const statusLabel: Record<NonNullable<SaveStatus>, string> = {
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed — is the keyframe server running?",
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", top: 0, left: 0, width: videoWidth, height: videoHeight }}
      onPointerMove={showHandles ? handlePointerMove : undefined}
      onPointerUp={showHandles ? handlePointerUp : undefined}
    >
      {/* Transformed screen content */}
      <div
        style={{
          position: "absolute",
          width: contentWidth,
          height: contentHeight,
          transformOrigin: "0 0",
          transform: matrix,
          overflow: "hidden",
          outline: showHandles ? "3px dashed rgba(0,255,136,0.5)" : undefined,
        }}
      >
        {children}
      </div>

      {/* Dev corner handles */}
      {showHandles &&
        (["tl", "tr", "br", "bl"] as const).map((corner) => (
          <div
            key={corner}
            onPointerDown={(e) => handlePointerDown(corner, e)}
            style={{
              position: "absolute",
              left: corners[corner].x,
              top: corners[corner].y,
              width: 56,
              height: 56,
              marginLeft: -28,
              marginTop: -28,
              borderRadius: "50%",
              background: "#00ff88",
              border: "4px solid white",
              cursor: dragging?.corner === corner ? "grabbing" : "grab",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
              zIndex: 9999,
              touchAction: "none",
            }}
          />
        ))}

      {/* Dev HUD */}
      {showHandles && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 40,
            background: "rgba(0,0,0,0.88)",
            color: "#00ff88",
            fontFamily: "monospace",
            fontSize: 26,
            lineHeight: 1.6,
            padding: "24px 30px",
            borderRadius: 12,
            whiteSpace: "pre",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {`frame ${frame} | ${screenId}\n`}
          {JSON.stringify(roundCorners(corners), null, 2)}
          {saveStatus && `\n\n${statusLabel[saveStatus]}`}
        </div>
      )}
    </div>
  );
};
