import { useEffect, useState } from "react";
import { interpolate } from "remotion";
import type { ScreenKeyframe } from "../videoCompositions/ScreenView";
import type { Corners } from "./computeMatrix3d";
import screenKeyframesData from "../screen-keyframes.json";

// ── Module-level singleton state ──────────────────────────────────────────────

// Initialize to first available screen so handles show immediately on load
const _screens = (screenKeyframesData as { screens: Record<string, unknown[]> }).screens;
let _activeScreenId: string | null = Object.keys(_screens)[0] ?? null;
let _activeKfFrame: number | null = null;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export function setActiveScreenId(id: string | null) {
  _activeScreenId = id;
  _activeKfFrame = null; // reset active KF when switching screens
  notify();
}

export function setActiveKfFrame(frame: number | null) {
  _activeKfFrame = frame;
  notify();
}

export function getActiveScreenId() { return _activeScreenId; }
export function getActiveKfFrame() { return _activeKfFrame; }

// ── React hook ────────────────────────────────────────────────────────────────

export function useScreenEditorState() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const trigger = () => rerender((n) => n + 1);
    _listeners.add(trigger);
    return () => { _listeners.delete(trigger); };
  }, []);
  return { activeScreenId: _activeScreenId, activeKfFrame: _activeKfFrame };
}

// ── Shared interpolation utility ──────────────────────────────────────────────

export function interpolateCorners(frame: number, keyframes: ScreenKeyframe[]): Corners {
  const frames = keyframes.map((k) => k.frame);
  const opts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  return {
    tl: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.tl.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.tl.y), opts) },
    tr: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.tr.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.tr.y), opts) },
    br: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.br.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.br.y), opts) },
    bl: { x: interpolate(frame, frames, keyframes.map((k) => k.corners.bl.x), opts), y: interpolate(frame, frames, keyframes.map((k) => k.corners.bl.y), opts) },
  };
}
