import { useCallback, useEffect, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { getRemotionEnvironment, Internals, useCurrentFrame, useVideoConfig } from "remotion";
import screenKeyframesData from "../screen-keyframes.json";
import { interpolateCorners, setActiveKfFrame, setActiveScreenId, setHandlesVisible, useScreenEditorState } from "../utils/screenEditorState";
import type { ScreenKeyframe } from "./ScreenView";

const KEYFRAME_SERVER = "http://localhost:3001";
type SaveStatus = "saving" | "saved" | "error" | null;

const STATUS_LABEL: Record<NonNullable<SaveStatus>, string> = {
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed — is the keyframe server running?",
};

function roundCorners(c: ReturnType<typeof interpolateCorners>) {
  const r = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });
  return { tl: r(c.tl), tr: r(c.tr), br: r(c.br), bl: r(c.bl) };
}

export const ScreenEditorHUD: React.FC = () => {
  const { isRendering } = getRemotionEnvironment();
  const frame = useCurrentFrame();
  const { id: compositionId, width: videoWidth, height: videoHeight } = useVideoConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setTimelineFrame = (Internals as any).Timeline.useTimelineSetFrame() as (
    updater: (prev: Record<string, number>) => Record<string, number>
  ) => void;

  const { activeScreenId, activeKfFrame, handlesVisible } = useScreenEditorState();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [newScreenName, setNewScreenName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [roundedCornersInput, setRoundedCornersInput] = useState("");

  const allScreens = (screenKeyframesData as { screens: Record<string, ScreenKeyframe[]>; screenMeta?: Record<string, { roundedCorners?: number }> }).screens;
  const allScreenMeta = (screenKeyframesData as { screenMeta?: Record<string, { roundedCorners?: number }> }).screenMeta ?? {};
  const screenIds = Object.keys(allScreens);
  const activeKeyframes: ScreenKeyframe[] = activeScreenId ? (allScreens[activeScreenId] ?? []) : [];

  useEffect(() => {
    const saved = activeScreenId ? (allScreenMeta[activeScreenId]?.roundedCorners ?? 0) : 0;
    setRoundedCornersInput(String(saved));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreenId]);

  if (isRendering) return null;

  const seekTo = (f: number) => setTimelineFrame((prev) => ({ ...prev, [compositionId]: f }));

  const postKeyframe = async (screenId: string, targetFrame: number, corners: object) => {
    setSaveStatus("saving");
    try {
      const res = await fetch(`${KEYFRAME_SERVER}/keyframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId, frame: targetFrame, corners }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 700);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleSelectKf = (kf: ScreenKeyframe) => {
    if (activeKfFrame === kf.frame) {
      setActiveKfFrame(null);
    } else {
      setActiveKfFrame(kf.frame);
      seekTo(kf.absoluteFrame ?? kf.frame);
    }
  };

  const handleDeleteKf = useCallback(async (kf: ScreenKeyframe) => {
    if (!activeScreenId) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${KEYFRAME_SERVER}/delete-keyframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId: activeScreenId, frame: kf.frame }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (activeKfFrame === kf.frame) setActiveKfFrame(null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 700);
    } catch {
      setSaveStatus("error");
    }
  }, [activeScreenId, activeKfFrame]);

  const handleAddKfAtCurrentFrame = useCallback(async () => {
    if (!activeScreenId) return;
    const corners = activeKeyframes.length > 0
      ? roundCorners(interpolateCorners(frame, activeKeyframes))
      : { tl: { x: 0, y: 0 }, tr: { x: videoWidth, y: 0 }, br: { x: videoWidth, y: videoHeight }, bl: { x: 0, y: videoHeight } };
    await postKeyframe(activeScreenId, frame, corners);
  }, [activeScreenId, activeKeyframes, frame, videoWidth, videoHeight]);

  const handleCreateScreen = useCallback(async () => {
    const name = newScreenName.trim();
    if (!name) return;
    const corners = { tl: { x: 0, y: 0 }, tr: { x: videoWidth, y: 0 }, br: { x: videoWidth, y: videoHeight }, bl: { x: 0, y: videoHeight } };
    await postKeyframe(name, 0, corners);
    setActiveScreenId(name);
    setNewScreenName("");
    setShowNewInput(false);
  }, [newScreenName, videoWidth, videoHeight]);

  const handleSaveRoundedCorners = useCallback(async (value: string) => {
    if (!activeScreenId) return;
    const n = parseFloat(value);
    if (isNaN(n)) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${KEYFRAME_SERVER}/screen-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenId: activeScreenId, roundedCorners: n }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 700);
    } catch {
      setSaveStatus("error");
    }
  }, [activeScreenId]);

  // ── Styles ────────────────────────────────────────────────────────────────

  const hudStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 40,
    left: 40,
    background: "rgba(0,0,0,0.88)",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: 26,
    lineHeight: 1.5,
    padding: "24px 30px",
    borderRadius: 12,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minWidth: 520,
  };

  const rowStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" };

  const btnStyle = (active = false, accent = false): React.CSSProperties => ({
    background: active ? "#00ff88" : accent ? "transparent" : "rgba(255,255,255,0.1)",
    color: active ? "#000" : accent ? "#00ff88" : "#fff",
    border: `2px solid ${active ? "#00ff88" : accent ? "#00ff88" : "rgba(255,255,255,0.2)"}`,
    borderRadius: 8,
    padding: "6px 18px",
    fontSize: 24,
    fontFamily: "monospace",
    cursor: "pointer",
    lineHeight: 1,
  });

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 24,
    fontFamily: "monospace",
    cursor: "pointer",
    outline: "none",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    border: "2px solid #00ff88",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 24,
    fontFamily: "monospace",
    outline: "none",
    width: 200,
  };

  const eyeBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    color: handlesVisible ? "#00ff88" : "rgba(255,255,255,0.4)",
    lineHeight: 1,
    flexShrink: 0,
  };

  const EyeIcon = handlesVisible ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  if (!handlesVisible) {
    return (
      <div style={{ position: "absolute", bottom: 40, left: 40, zIndex: 9999 }}>
        <button
          style={{ ...eyeBtn, background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 10px" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setHandlesVisible(true)}
        >
          {EyeIcon}
        </button>
      </div>
    );
  }

  return (
    <div style={hudStyle}>
      {/* Screen selector row */}
      <div style={rowStyle}>
        <button style={eyeBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => setHandlesVisible(false)}>
          {EyeIcon}
        </button>
        <span style={{ color: "#aaa", fontSize: 22 }}>Screen</span>
        <select
          style={selectStyle}
          value={activeScreenId ?? ""}
          onChange={(e) => setActiveScreenId(e.target.value || null)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <option value="">— select —</option>
          {screenIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

        {showNewInput ? (
          <>
            <input
              style={inputStyle}
              value={newScreenName}
              onChange={(e) => setNewScreenName(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateScreen(); if (e.key === "Escape") setShowNewInput(false); }}
              placeholder="name..."
              autoFocus
            />
            <button style={btnStyle(false, true)} onPointerDown={(e) => e.stopPropagation()} onClick={handleCreateScreen}>
              Create
            </button>
            <button style={btnStyle()} onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowNewInput(false)}>
              ✕
            </button>
          </>
        ) : (
          <button style={btnStyle(false, true)} onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowNewInput(true)}>
            + New
          </button>
        )}

        <span style={{ color: "#aaa", fontSize: 22, marginLeft: "auto" }}>f:{frame}</span>
      </div>

      {/* Keyframe navigation row */}
      {activeScreenId && (
        <div style={rowStyle}>
          {activeKeyframes.map((kf, i) => (
            <div key={kf.frame} style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `2px solid ${activeKfFrame === kf.frame ? "#00ff88" : "rgba(255,255,255,0.2)"}` }}>
              <button
                style={{ ...btnStyle(activeKfFrame === kf.frame), border: "none", borderRadius: 0 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleSelectKf(kf)}
              >
                KF{i + 1} · f:{kf.frame}
              </button>
              <button
                style={{ ...btnStyle(), border: "none", borderLeft: "1px solid rgba(255,255,255,0.15)", borderRadius: 0, padding: "6px 12px", color: "#ff6666" }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleDeleteKf(kf)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            style={btnStyle(false, true)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleAddKfAtCurrentFrame}
          >
            + f:{frame}
          </button>
        </div>
      )}

      {/* Rounded corners */}
      {activeScreenId && (
        <div style={rowStyle}>
          <span style={{ color: "#aaa", fontSize: 22 }}>Radius</span>
          <input
            style={{ ...inputStyle, width: 100, borderColor: "rgba(255,255,255,0.3)" }}
            type="number"
            min={0}
            value={roundedCornersInput}
            onChange={(e) => setRoundedCornersInput(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={() => handleSaveRoundedCorners(roundedCornersInput)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveRoundedCorners(roundedCornersInput); }}
          />
        </div>
      )}

      {/* Corners */}
      {/* {activeScreenId && activeKeyframes.length > 0 && (() => {
        const displayed = activeKfFrame !== null
          ? activeKeyframes.find((k) => k.frame === activeKfFrame)?.corners
          : interpolateCorners(frame, activeKeyframes);
        return displayed ? (
          <div style={{ color: "#00ff88", whiteSpace: "pre", fontSize: 22, lineHeight: 1.5 }}>
            {JSON.stringify(roundCorners(displayed), null, 2)}
          </div>
        ) : null;
      })()} */}

      {/* Status */}
      {saveStatus && (
        <div style={{ color: saveStatus === "error" ? "#ff5555" : "#00ff88", fontSize: 22 }}>
          {STATUS_LABEL[saveStatus]}
        </div>
      )}
    </div>
  );
};
