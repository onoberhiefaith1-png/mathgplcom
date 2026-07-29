// Shared types for the MathGPL Game Builder.

export type AssetKind = "background" | "reward" | "progress_bar" | "effect";
export type MediaType = "image" | "video";
/** Where a canvas media path resolves from: a private storage object or a public URL. */
export type MediaSource = "storage" | "url";

/** CSS mix-blend-mode subset offered in the editor. */
export type BlendMode = "normal" | "screen" | "add" | "multiply" | "lighten";
/** Cheap background removal for effect clips. */
export type BgRemoval = "none" | "screen-black" | "chroma";
/** When an element's motion starts. */
export type MotionTrigger = "auto" | "on-enter" | "loop";
/** Direction the tint gradient leans, so flat sprites match the scene lighting. */
export type TintDirection =
  | "even"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "inward"
  | "outward";

/** Directional color grade that blends a flat asset into the background. */
export interface TintSettings {
  /** hex color pulled toward the scene's dominant light */
  color: string;
  /** 0..1 overall intensity (0 = off) */
  strength: number;
  /** which way the tint leans across the sprite */
  direction: TintDirection;
  /** 0..1 how gradual the falloff is */
  softness: number;
}

/** How a progress tower's lit slots are filled. */
export type ProgressFillStyle = "plain" | "effect";

/** Left/right axis shared by the lean and slide leans. */
export type SlantAxisDir = "left" | "right";
/** Forward/back axis for the base-fixed top tip. */
export type TiltDir = "in" | "out";
/** @deprecated legacy single-direction slant; kept for migration. */
export type SlantDirection = "left" | "right" | "in" | "out";

/** One lean axis: a direction plus a 0..1 strength (0 = off). */
export interface SlantAxis<D extends string> {
  dir: D;
  /** 0..1 amount (0 = upright) */
  amount: number;
}

/**
 * Three independent leans that combine, all anchored at the base:
 * - `lean` — sideways skew (Left/Right)
 * - `slide` — 3D swing (Slide Left/Right), the old In/Out function
 * - `tilt` — base-fixed top tip in/out (new In/Out)
 */
export interface SlantSettings {
  lean: SlantAxis<SlantAxisDir>;
  slide: SlantAxis<SlantAxisDir>;
  tilt: SlantAxis<TiltDir>;
}

export interface GameAssetRow {
  id: string;
  owner_id: string;
  kind: AssetKind;
  media_type: MediaType;
  title: string;
  storage_path: string;
  processed_path: string | null;
  processed_status: "none" | "pending" | "done" | "failed";
  created_at: string;
  updated_at: string;
}

export type AnimationType = "none" | "float" | "sway" | "pulse" | "travel";

export interface AnimationSettings {
  type: AnimationType;
  // amplitude expressed as fraction of the stage (0..1)
  amplitude: number;
  // seconds per full cycle
  speed: number;
  loop: boolean;
  // seconds before the motion begins
  delay?: number;
  // fade in / out durations in seconds (0 = off)
  fadeIn?: number;
  fadeOut?: number;
  // when the motion is allowed to run
  trigger?: MotionTrigger;
}

/** A single per-slot fill: either an energy reference or a plain color. */
export interface SlotEffect {
  /** how this slot fills; defaults to "effect" when omitted (legacy overrides). */
  fill?: ProgressFillStyle;
  /** solid color used when fill === "plain". */
  plainColor?: string;
  effectAssetId?: string;
  effectStoragePath?: string;
  effectMediaType?: MediaType;
  effectSource?: MediaSource;
}

export interface ProgressConfig {
  /** number of slots in the tower (defaults to 10). */
  segments: number;
  /** built-in frame design id; when absent the element's own storagePath is used. */
  presetId?: string;
  /** marks the student must earn to fully charge the tower. */
  totalMarks: number;
  /** marks earned so far — drives which slots are lit (editor/preview driver). */
  currentMarks: number;
  // Default energy effect used by every slot unless overridden.
  effectAssetId?: string;
  effectStoragePath?: string;
  effectMediaType?: MediaType;
  effectSource?: MediaSource;
  /** per-slot energy overrides, keyed by slot index (0 = bottom). */
  slotEffects?: Record<number, SlotEffect>;
  /** how lit slots are filled: a solid color or the energy media. */
  fillStyle?: ProgressFillStyle;
  /** color used in plain fill mode; defaults to the preset's glow tint. */
  plainColor?: string;
  /** hidden lesson-note notebook that authors this bar's game questions. */
  questionNotebookId?: string;
  /** the single "Game Question" section inside that notebook. */
  questionSectionId?: string;
  /**
   * Teacher-set progress goal as a percentage of Grand Total.
   * Grand Total = totalMarks × currentActiveStudents (live).
   * Required Score = Grand Total × progressGoalPct/100.
   * Defaults to 100 for backward compat with existing games.
   */
  progressGoalPct?: number;
  // preview fill 0..1 used inside the editor (legacy; derived from marks now)
  fill: number;
  glow: number;
  // fraction of the box the effect occupies
  effectScale: number;
}

/** Fraction of the tower charged, derived from marks. */
export const progressFill = (p: ProgressConfig): number => {
  const total = p.totalMarks > 0 ? p.totalMarks : 1;
  return Math.min(1, Math.max(0, p.currentMarks / total));
};


export interface CanvasElement {
  id: string;
  kind: AssetKind;
  assetId: string;
  mediaType: MediaType;
  // The transparent/processed path when available, else the raw path.
  storagePath: string;
  // Where storagePath resolves from. Defaults to "storage" for backward compat.
  source?: MediaSource;
  // normalized center position 0..1 relative to the stage
  x: number;
  y: number;
  // width as a fraction of the stage width (height derives from natural ratio)
  scale: number;
  z: number;
  rotation: number;
  opacity: number;
  animation: AnimationSettings;
  progress?: ProgressConfig;
  // Compositing
  blend?: BlendMode;
  bgRemoval?: BgRemoval;
  // Chroma-key settings (used when bgRemoval === "chroma", videos only).
  keyColor?: { r: number; g: number; b: number };
  keyTolerance?: number;
  // Directional color grade so a flat asset blends into the scene lighting.
  tint?: TintSettings;
  // Lean/skew so a flat asset matches the background's perspective (base fixed).
  slant?: SlantSettings;
  // Optional display label shown in the effects rail.
  label?: string;
}

/** A single scene inside a game — its own background + elements. */
export interface Scene {
  id: string;
  title: string;
  tag: string;
  elements: CanvasElement[];
  cameraTargetId?: string | null;
}

/**
 * Persisted canvas. The editor is a single continuous vertically extendable
 * canvas — `scenes` always contains exactly one entry, and `heightUnits`
 * measures how many 16:9 viewports tall the canvas is (1 = default).
 * Legacy games stored `{ elements }` or multiple `scenes`; both are migrated
 * into the single-scene shape by `normalizeCanvas`.
 */
export interface GameCanvas {
  scenes: Scene[];
  activeSceneId?: string | null;
  /** Number of 16:9 vertical sections the canvas spans. Defaults to 1. */
  heightUnits?: number;
  /** @deprecated legacy single-canvas shape */
  elements?: CanvasElement[];
}

export interface GameRow {
  id: string;
  owner_id: string;
  title: string;
  subtopic: string | null;
  topic: string | null;
  thumbnail_path: string | null;
  canvas: GameCanvas;
  created_at: string;
  updated_at: string;
}

export const defaultAnimation = (): AnimationSettings => ({
  type: "none",
  amplitude: 0.04,
  speed: 3,
  loop: true,
  delay: 0,
  fadeIn: 0,
  fadeOut: 0,
  trigger: "auto",
});

export const uid = () => Math.random().toString(36).slice(2, 10);

export const makeScene = (index = 0): Scene => ({
  id: uid(),
  title: `Scene ${index + 1}`,
  tag: "",
  elements: [],
  cameraTargetId: null,
});

/**
 * Normalize any persisted canvas into the scene-based shape.
 * Legacy `{ elements: [...] }` becomes a single scene, so old games load.
 */
export const normalizeCanvas = (raw: unknown): GameCanvas => {
  const canvas = (raw ?? {}) as GameCanvas;
  if (Array.isArray(canvas.scenes) && canvas.scenes.length > 0) {
    const scenes = canvas.scenes;
    // Multi-scene legacy: flatten into one continuous vertical canvas.
    if (scenes.length > 1) {
      const N = scenes.length;
      const merged: CanvasElement[] = [];
      scenes.forEach((s, i) => {
        (s.elements ?? []).forEach((el) => {
          const e = withElementDefaults(el);
          // Remap y from within one 16:9 section to the full N-section canvas.
          merged.push({ ...e, y: (i + Math.min(1, Math.max(0, e.y))) / N });
        });
      });
      const single: Scene = { ...makeScene(0), elements: merged };
      return { scenes: [single], activeSceneId: single.id, heightUnits: N };
    }
    const only = scenes[0];
    const single: Scene = {
      ...only,
      cameraTargetId: only.cameraTargetId ?? null,
      tag: only.tag ?? "",
      title: only.title ?? "Canvas",
      elements: (only.elements ?? []).map(withElementDefaults),
    };
    return {
      scenes: [single],
      activeSceneId: single.id,
      heightUnits: Math.max(1, Math.floor(Number(canvas.heightUnits) || 1)),
    };
  }
  // Legacy: wrap flat elements into one scene.
  const legacy = (canvas.elements ?? []).map(withElementDefaults);
  const scene = { ...makeScene(0), elements: legacy };
  return { scenes: [scene], activeSceneId: scene.id, heightUnits: 1 };
};

/** Default directional tint (off until strength is dialed up). */
export const defaultTint = (): TintSettings => ({
  color: "#3aa0ff",
  strength: 0,
  direction: "even",
  softness: 0.5,
});

/** Default slant (all axes upright until an amount is dialed up). */
export const defaultSlant = (): SlantSettings => ({
  lean: { dir: "left", amount: 0 },
  slide: { dir: "left", amount: 0 },
  tilt: { dir: "in", amount: 0 },
});

/**
 * Normalize any persisted slant into the three-axis shape. Legacy games stored
 * a single `{ direction, amount }`: left/right map to `lean`, and in/out map to
 * `slide` (which is what the old In/Out actually rendered).
 */
export const migrateSlant = (raw: unknown): SlantSettings => {
  const base = defaultSlant();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<SlantSettings> & { direction?: SlantDirection; amount?: number };
  // Already new shape.
  if (s.lean || s.slide || s.tilt) {
    return {
      lean: { ...base.lean, ...s.lean },
      slide: { ...base.slide, ...s.slide },
      tilt: { ...base.tilt, ...s.tilt },
    };
  }
  // Legacy single-axis shape.
  if (s.direction && typeof s.amount === "number") {
    if (s.direction === "left" || s.direction === "right") {
      base.lean = { dir: s.direction, amount: s.amount };
    } else {
      base.slide = { dir: s.direction === "in" ? "left" : "right", amount: s.amount };
    }
  }
  return base;
};

/** Backfill new element fields on load. */
export const withElementDefaults = (el: CanvasElement): CanvasElement => ({
  blend: "normal",
  bgRemoval: "none",
  ...el,
  animation: { ...defaultAnimation(), ...(el.animation ?? {}) },
  slant: el.slant ? migrateSlant(el.slant) : undefined,
  progress: el.progress
    ? {
        ...el.progress,
        segments: el.progress.segments ?? 10,
        totalMarks: el.progress.totalMarks ?? 0,
        currentMarks: el.progress.currentMarks ?? 0,
        fill: el.progress.fill ?? 0,
        glow: el.progress.glow ?? 0.5,
        effectScale: el.progress.effectScale ?? 1,
        fillStyle: el.progress.fillStyle ?? "plain",
        progressGoalPct: el.progress.progressGoalPct ?? 100,
      }
    : undefined,
});

export const GAME_ASSETS_BUCKET = "game-assets";
