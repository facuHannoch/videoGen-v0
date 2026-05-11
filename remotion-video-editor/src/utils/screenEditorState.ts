import { useEffect, useState } from "react";
import { interpolate } from "remotion";
import type { ScreenKeyframe } from "../videoCompositions/ScreenView";
import type { Corners } from "./computeMatrix3d";
import screenKeyframesData from "../screen-keyframes.json";

// ── Module-level singleton state ──────────────────────────────────────────────

const _screens = (screenKeyframesData as { screens: Record<string, unknown[]> }).screens;
const _STORAGE_KEY = "screenEditor_activeScreenId";

function getInitialScreenId(): string | null {
  // Persist across HMR cycles (module re-evaluates when JSON changes)
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(_STORAGE_KEY);
    if (stored && _screens[stored]) return stored;
  }
  return Object.keys(_screens)[0] ?? null;
}

let _activeScreenId: string | null = getInitialScreenId();
let _activeKfFrame: number | null = null;
let _handlesVisible = true;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export function setActiveScreenId(id: string | null) {
  _activeScreenId = id;
  _activeKfFrame = null;
  if (typeof localStorage !== "undefined") {
    if (id) localStorage.setItem(_STORAGE_KEY, id);
    else localStorage.removeItem(_STORAGE_KEY);
  }
  notify();
}

export function setActiveKfFrame(frame: number | null) {
  _activeKfFrame = frame;
  notify();
}

export function getActiveScreenId() { return _activeScreenId; }
export function getActiveKfFrame() { return _activeKfFrame; }
export function setHandlesVisible(v: boolean) { _handlesVisible = v; notify(); }

// ── React hook ────────────────────────────────────────────────────────────────

export function useScreenEditorState() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const trigger = () => rerender((n) => n + 1);
    _listeners.add(trigger);
    return () => { _listeners.delete(trigger); };
  }, []);
  return { activeScreenId: _activeScreenId, activeKfFrame: _activeKfFrame, handlesVisible: _handlesVisible };
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
