// Where the Adventure's designed bars sit in the player. The editor stores each
// bar as a centre point and width on a 16:9 stage; the player draws that same
// stage — the video's own frame, scaled to cover the screen — and puts every bar
// at the stored place inside it, so phone, tablet and desktop agree.
import { getPreset } from "@/lib/games/progressPresets";
import type { CanvasElement } from "@/lib/games/types";

export const STAGE_ASPECT = 16 / 9;

export type StageRect = { width: number; height: number; left: number; top: number };

/** The 16:9 stage scaled to cover a viewport (the video fills the screen the same way), centred. */
export function coverStage(viewW: number, viewH: number, aspect = STAGE_ASPECT): StageRect {
  if (!(viewW > 0) || !(viewH > 0)) return { width: 0, height: 0, left: 0, top: 0 };
  const width = Math.max(viewW, viewH * aspect);
  const height = width / aspect;
  return { width, height, left: (viewW - width) / 2, top: (viewH - height) / 2 };
}

/** Plain defaults, used only when the bar was never placed in the editor. */
export const DEFAULT_BAR = { x: 0.5, y: 0.5, scale: 0.12, rotation: 0 } as const;

export type BarBox = {
  /** Centre, as a share of the stage (0..1). */
  x: number;
  y: number;
  /** Width as a share of the stage width. */
  widthPct: number;
  /** Stored rotation in degrees, around the bottom centre (as the editor does). */
  rotation: number;
  /** Box height ÷ width (the preset's shape). */
  heightPerWidth: number;
  z: number;
  opacity: number;
  /** Whether any of the geometry came from the editor (false = defaults). */
  stored: boolean;
};

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The bar's stored geometry, exactly as the editor reads it. */
export function barBoxOf(el: Pick<CanvasElement, "x" | "y" | "scale" | "rotation" | "z" | "opacity" | "progress">): BarBox {
  const stored = finite(el.x) && finite(el.y) && finite(el.scale);
  const aspect = getPreset(el.progress?.presetId ?? "")?.aspect ?? 0.5;
  return {
    x: finite(el.x) ? el.x : DEFAULT_BAR.x,
    y: finite(el.y) ? el.y : DEFAULT_BAR.y,
    widthPct: (finite(el.scale) ? el.scale : DEFAULT_BAR.scale) * 100,
    rotation: finite(el.rotation) ? el.rotation : DEFAULT_BAR.rotation,
    heightPerWidth: aspect > 0 ? 1 / aspect : 2,
    z: finite(el.z) ? el.z : 0,
    opacity: finite(el.opacity) ? el.opacity : 1,
    stored,
  };
}

/** Pixel box of a bar's centre-anchored rectangle inside the stage (before rotation). */
export function barPixels(box: BarBox, stage: StageRect): { left: number; top: number; width: number; height: number } {
  const width = (box.widthPct / 100) * stage.width;
  const height = width * box.heightPerWidth;
  return { left: box.x * stage.width - width / 2, top: box.y * stage.height - height / 2, width, height };
}

/**
 * Stacking inside the player. The bars live in the stage layer with the video;
 * the Game (writing surface, HUD, arrow pad, floating numbers) is a later layer,
 * so it is always painted in front of them, and the bars never take touches.
 */
export const PLAYER_LAYERS = {
  backdrop: 0,
  stage: 1,
  /** Default (undesigned) side bars. */
  defaultBars: 5,
  game: 10,
} as const;
export const BAR_LAYER = { pointerEvents: "none" as const, zIndex: PLAYER_LAYERS.stage };

/**
 * The element the editor's own renderer draws for a learning point's bar: the
 * stored geometry untouched (defaults only for a field that was never stored),
 * with the live value written into the bar's marks.
 *
 * `current`/`max` are the fill (marks, or time left). A Video Timer reads its
 * marks as time *used* — the clock is the loop region — so it is inverted.
 */
export function barElementFor(el: CanvasElement, current: number, max: number, opts: { fillIsTimeLeft?: boolean } = {}): CanvasElement {
  const box = barBoxOf(el);
  const safeMax = max > 0 ? max : 1;
  const value = Math.min(safeMax, Math.max(0, Number.isFinite(current) ? current : 0));
  const videoTimer = el.progress?.timerDisplay === "video" && Boolean(el.progress?.timerVideo?.storagePath);
  const marks = opts.fillIsTimeLeft && videoTimer ? safeMax - value : value;
  return {
    ...el,
    x: box.x,
    y: box.y,
    scale: box.widthPct / 100,
    rotation: box.rotation,
    z: box.z,
    opacity: box.opacity,
    progress: el.progress ? { ...el.progress, currentMarks: marks, totalMarks: safeMax } : el.progress,
  };
}
