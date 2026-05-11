import { useCallback, useEffect, useRef, useState } from "react";
import { getRemotionEnvironment, Internals, useCurrentFrame, useVideoConfig } from "remotion";
import { computeMatrix3d, Corners, Point } from "../utils/computeMatrix3d";
import { getActiveKfFrame, interpolateCorners, useScreenEditorState } from "../utils/screenEditorState";
import screenKeyframesData from "../screen-keyframes.json";

export type { Corners, Point };

export interface ScreenKeyframe {
  frame: number;
  absoluteFrame?: number; // absolute position in video timeline, used for seeking
  corners: Corners;
}

interface ScreenViewProps {
  screenId: string;
  keyframes: ScreenKeyframe[];
  contentWidth?: number;
  contentHeight?: number;
  children?: React.ReactNode;
}

const KEYFRAME_SERVER = "http://localhost:3001";

function roundCorners(c: Corners): Corners {
  const r = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
  return { tl: r(c.tl), tr: r(c.tr), br: r(c.br), bl: r(c.bl) };
}

function naturalDimensions(keyframes: ScreenKeyframe[]): { w: number; h: number } | null {
  if (!keyframes.length) return null;
  const { tl, tr, br, bl } = keyframes[0].corners;
  const w = ((tr.x - tl.x) + (br.x - bl.x)) / 2;
  const h = ((bl.y - tl.y) + (br.y - tr.y)) / 2;
  return { w: Math.round(w), h: Math.round(h) };
}

export const ScreenView: React.FC<ScreenViewProps> = ({
  screenId,
  keyframes,
  contentWidth: contentWidthProp,
  contentHeight: contentHeightProp,
  children,
}) => {
  const frame = useCurrentFrame();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const absoluteFrame = (Internals as any).Timeline.useAbsoluteTimelinePosition() as number;
  const { width: videoWidth, height: videoHeight } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const { activeScreenId, activeKfFrame, handlesVisible } = useScreenEditorState();

  const natural = naturalDimensions(keyframes);
  const contentWidth = contentWidthProp ?? natural?.w ?? videoWidth;
  const contentHeight = contentHeightProp ?? natural?.h ?? videoHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const [devCorners, setDevCorners] = useState<Corners | null>(null);
  const [dragging, setDragging] = useState<{
    corner: keyof Corners;
    startScreen: Point;
    startCorner: Point;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error" | null>(null);

  const devCornersRef = useRef(devCorners);
  devCornersRef.current = devCorners;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const absoluteFrameRef = useRef(absoluteFrame);
  absoluteFrameRef.current = absoluteFrame;

  // Reset drag state when keyframes hot-reload or active screen changes
  useEffect(() => {
    setDevCorners(null);
  }, [keyframes, activeScreenId]);

  const showHandles = !isRendering && handlesVisible;
  const isActive = showHandles && screenId === activeScreenId;

  const baseCorners = interpolateCorners(frame, keyframes);
  const activeKfCorners = isActive && activeKfFrame !== null
    ? keyframes.find((k) => k.frame === activeKfFrame)?.corners ?? null
    : null;
  const corners = devCorners ?? activeKfCorners ?? baseCorners;
  const matrix = computeMatrix3d(contentWidth, contentHeight, corners);
  const roundedCorners = (screenKeyframesData as { screenMeta?: Record<string, { roundedCorners?: number }> }).screenMeta?.[screenId]?.roundedCorners ?? 0;

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
        ...(prev ?? corners),
        [dragging.corner]: { x: dragging.startCorner.x + dx, y: dragging.startCorner.y + dy },
      }));
    },
    [dragging, getScale, corners]
  );

  const handlePointerUp = useCallback(async () => {
    setDragging(null);
    const current = devCornersRef.current;
    if (!current) return;

    const akfFrame = getActiveKfFrame();
    const targetFrame = akfFrame ?? frameRef.current;
    // absoluteFrame: offset absolute frame by the difference between current relative and absolute
    const frameOffset = absoluteFrameRef.current - frameRef.current;
    const targetAbsoluteFrame = targetFrame + frameOffset;

    setSaveStatus("saving");
    try {
      const res = await fetch(`${KEYFRAME_SERVER}/keyframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId, frame: targetFrame, absoluteFrame: targetAbsoluteFrame, corners: roundCorners(current) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 700);
    } catch (e) {
      console.error("[ScreenView] save failed:", e);
      setSaveStatus("error");
    }
  }, [screenId]);

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
          borderRadius: roundedCorners,
          boxShadow: showHandles ? "inset 0 0 0 3px rgba(0,255,136,0.5)" : undefined,
        }}
      >
        {children}
      </div>

      {/* Corner handles */}
      {showHandles &&
        (["tl", "tr", "br", "bl"] as const).map((corner) => (
          <div
            key={corner}
            onPointerDown={(e) => handlePointerDown(corner, e)}
            style={{
              position: "absolute",
              left: corners[corner].x,
              top: corners[corner].y,
              width: 80,
              height: 80,
              marginLeft: -40,
              marginTop: -40,
              borderRadius: "50%",
              border: "4px solid rgba(0,255,136,0.5)",
              background: "rgba(0,255,136,0.08)",
              cursor: dragging?.corner === corner ? "grabbing" : "grab",
              zIndex: 9999,
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Inner hollow ring — marks the exact point */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "4px solid #00ff88",
                background: "transparent",
                pointerEvents: "none",
              }}
            />
          </div>
        ))}

      {/* Small save toast near top-left of the screen area */}
      {showHandles && saveStatus && (
        <div
          style={{
            position: "absolute",
            top: Math.min(corners.tl.y, corners.tr.y) - 60,
            left: (corners.tl.x + corners.tr.x) / 2 - 80,
            background: saveStatus === "error" ? "rgba(255,50,50,0.9)" : "rgba(0,0,0,0.85)",
            color: saveStatus === "error" ? "#fff" : "#00ff88",
            fontFamily: "monospace",
            fontSize: 22,
            padding: "8px 20px",
            borderRadius: 8,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save failed"}
        </div>
      )}
    </div>
  );
};
