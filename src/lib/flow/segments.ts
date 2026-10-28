import type { FlowClip, FlowScene } from "./types";

export const totalDuration = (clips: FlowClip[]) =>
  clips.reduce((a, c) => a + (c.duration || 0), 0);

export interface SceneRange extends FlowScene {
  start: number;
  index: number;
}

/** Sort scenes by end point and derive start points (no gaps, no overlaps). */
export const withRanges = (scenes: FlowScene[]): SceneRange[] => {
  const sorted = [...scenes].sort((a, b) => a.end - b.end);
  let prev = 0;
  return sorted.map((s, index) => {
    const r = { ...s, start: prev, index };
    prev = s.end;
    return r;
  });
};

/** Map a global timeline time to a clip index + local time. */
export const locate = (clips: FlowClip[], t: number) => {
  let off = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clips[i].duration || 0;
    if (t < off + d || i === clips.length - 1) {
      return { index: i, local: Math.max(0, Math.min(d, t - off)), offset: off };
    }
    off += d;
  }
  return { index: 0, local: 0, offset: 0 };
};

export const validateScenes = (scenes: FlowScene[]): string[] => {
  const errs: string[] = [];
  const count = (t: string) => scenes.filter((s) => s.type === t).length;
  if (count("base") !== 1) errs.push("Exactly one Base scene is required.");
  if (count("flow_out") !== 1) errs.push("Exactly one Flow Out scene is required.");
  if (count("flow_in") !== 1) errs.push("Exactly one Flow In scene is required.");
  const r = withRanges(scenes);
  if (r.some((s) => s.end - s.start <= 0.02)) errs.push("Every scene must be longer than zero.");
  return errs;
};

export const fmt = (t: number) => `${t.toFixed(1)}s`;

const EMOJI_RE = /^\p{Extended_Pictographic}\uFE0F?/u;
/** One display identity per emotion: emoji OR text, never both. */
export const sceneLabel = (s: { name: string; emoji?: string; display?: "emoji" | "text" }): string => {
  const lead = s.name.match(EMOJI_RE)?.[0];
  const emoji = s.emoji || lead || "";
  const text = s.name.replace(EMOJI_RE, "").trim();
  const mode = s.display ?? (emoji ? "emoji" : "text");
  return mode === "emoji" && emoji ? emoji : text || emoji || "•";
};
