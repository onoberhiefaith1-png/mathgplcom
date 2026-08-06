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

/**
 * Which of the two fixed bars this is.
 *
 * - `time` — the system-owned Time Progress Bar. Never renamed, deleted or
 *   linked to questions; only its appearance and duration are editable.
 * - `learning` — the only bar linked to questions, scores and rewards.
 *
 * Legacy bars have no role and are treated as `learning`.
 */
export type BarRole = "time" | "learning";

export interface ProgressConfig {
  /** Fixed role of this bar inside its Scene / Learning Point. */
  role?: BarRole;
  /**
   * Time Progress Bar only — countdown length in seconds.
   * `0` (or missing) means **No Time**: no timer at all.
   */
  timeDurationSeconds?: number;

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

/**
 * A single scene inside a game — its own background + elements.
 *
 * In a Video Adventure the same Scene doubles as a **Checkpoint** (formerly
 * "Learning Point"): a loop region inside the background video that owns its
 * own elements (progress bars, rewards, effects, objects, characters).
 * Everything else about a Scene is unchanged, so the whole existing editor and
 * runtime keep working.
 */
export interface Scene {
  id: string;
  title: string;
  tag: string;
  elements: CanvasElement[];
  cameraTargetId?: string | null;
  /** Checkpoint loop start, in seconds into the background video. */
  loopStart?: number;
  /** Checkpoint loop end, in seconds into the background video. */
  loopEnd?: number;
  /** Per-checkpoint countdown. */
  timerEnabled?: boolean;
  /** Countdown length in seconds. */
  timeLimit?: number;
  timerVisible?: boolean;
}

/** The uploaded / linked video used as the adventure background. */
export interface VideoBackground {
  /** Storage object path or public URL, per `source`. */
  path: string;
  source: MediaSource;
  /** Seconds — filled in once metadata loads. */
  duration?: number;
  width?: number;
  height?: number;
  title?: string;
  /** Play the video's own audio track. */
  muted?: boolean;
}

/**
 * Persisted canvas. In classic (static background) mode the editor is a single
 * continuous vertically extendable canvas — `scenes` always contains exactly
 * one entry, and `heightUnits` measures how many 16:9 viewports tall it is.
 * Legacy games stored `{ elements }` or multiple `scenes`; both are migrated
 * into the single-scene shape by `normalizeCanvas`.
 *
 * When `video` is set the game is a **Video Adventure**: `scenes` holds one
 * entry per Checkpoint and is never flattened.
 */
/**
 * How an adventure is staged.
 *
 * - `static` — the classic still-image adventure canvas.
 * - `video`  — a moving video background with Checkpoints.
 *
 * More modes will be added here; everything else keys off this one field.
 */
export type AdventureMode = "static" | "video";

/**
 * A narration clip attached to an exact timestamp in the background video.
 *
 * - `once`   — plays the first time the playhead crosses `at` in a session; a
 *              loop wrapping back over the point does not replay it.
 * - `repeat` — plays on every crossing (reminder messages).
 */
export interface Narration {
  id: string;
  title: string;
  /** Storage object path or public URL, per `source`. */
  path: string;
  source: MediaSource;
  /** Activation point, in seconds into the video. */
  at: number;
  mode: "once" | "repeat";
}

/** A teacher-uploaded sound clip. Nothing is ever generated by the system. */
export interface SoundRef {
  path: string;
  source: MediaSource;
  title?: string;
  /** 0–1, default 1. */
  volume?: number;
}

/** Events a one-shot effect can be attached to. */
export type SoundEvent = "loop_start" | "goal" | "time_up" | "reward";

/** Every sound an adventure owns. All optional — silence is valid. */
export interface AdventureSounds {
  /** Loops for the whole game. */
  ambience?: SoundRef | null;
  /** Environmental music per scene / Learning Point, keyed by scene id. */
  music?: Record<string, SoundRef>;
  /** One-shot effects, keyed by event. */
  effects?: Partial<Record<SoundEvent, SoundRef>>;
}

export interface GameCanvas {
  /** Chosen staging mode. Defaults to `static` (or `video` when a video exists). */
  mode?: AdventureMode;
  scenes: Scene[];
  activeSceneId?: string | null;
  /** Number of 16:9 vertical sections the canvas spans. Defaults to 1. */
  heightUnits?: number;
  /** Video background — presence of this switches on Video Adventure mode. */
  video?: VideoBackground | null;
  /** Narration clips, each pinned to a timestamp in the video. */
  narrations?: Narration[];
  /** Teacher-uploaded ambience, music and effects. */
  sounds?: AdventureSounds | null;
  /** @deprecated legacy single-canvas shape */
  elements?: CanvasElement[];
}

/** Narrations in activation order, with defaults filled in. */
export const narrationsOf = (canvas: GameCanvas | null | undefined): Narration[] =>
  (canvas?.narrations ?? [])
    .filter((n) => n && typeof n.path === "string" && n.path.length > 0)
    .map((n) => ({
      ...n,
      title: n.title || "Narration",
      source: n.source ?? "storage",
      at: Math.max(0, Number(n.at) || 0),
      mode: (n.mode === "repeat" ? "repeat" : "once") as Narration["mode"],
    }))
    .sort((a, b) => a.at - b.at);

/** The sound set of a canvas, with empty collections filled in. */
export const soundsOf = (canvas: GameCanvas | null | undefined): AdventureSounds => ({
  ambience: canvas?.sounds?.ambience ?? null,
  music: canvas?.sounds?.music ?? {},
  effects: canvas?.sounds?.effects ?? {},
});


/** The adventure mode of a canvas, inferred for legacy rows without the field. */
export const adventureModeOf = (canvas: GameCanvas | null | undefined): AdventureMode =>
  canvas?.mode ?? (canvas?.video?.path ? "video" : "static");

/** Human label for a mode, used in pickers and headers. */
export const adventureModeLabel = (mode: AdventureMode): string =>
  mode === "video" ? "Video Adventure" : "Static Adventure";

/** True when this canvas uses a video background (Checkpoint mode). */
export const isVideoAdventure = (canvas: GameCanvas | null | undefined): boolean =>
  Boolean(canvas?.video?.path);

/** Checkpoints in play order. */
export const checkpointsOf = (canvas: GameCanvas): Scene[] =>
  (canvas.scenes ?? [])
    .filter((s) => typeof s.loopStart === "number" && typeof s.loopEnd === "number")
    .sort(
      (a, b) => (a.loopStart ?? 0) - (b.loopStart ?? 0),
    );

/** The checkpoint whose loop region contains `t` (seconds), if any. */
export const checkpointAt = (scenes: Scene[], t: number): Scene | null =>
  scenes.find(
    (s) =>
      typeof s.loopStart === "number" &&
      typeof s.loopEnd === "number" &&
      t >= s.loopStart &&
      t < s.loopEnd,
  ) ?? null;

/** A blank checkpoint covering [start, end] of the video. */
export const makeCheckpoint = (index: number, start: number, end: number): Scene => ({
  ...makeScene(index),
  title: `Checkpoint ${index + 1}`,
  loopStart: Math.max(0, start),
  loopEnd: Math.max(start + 0.5, end),
  timerEnabled: false,
  timeLimit: 300,
  timerVisible: true,
});

/**
 * Elements the runtime should consider. Staged adventures (video loops, or a
 * static adventure with several scenes) spread their elements across stages, so
 * all of them are in play and the runtime shows one stage at a time. A
 * single-scene static game only ever uses that scene.
 */
export const playableElements = (canvas: GameCanvas): CanvasElement[] => {
  if (isVideoAdventure(canvas) || (canvas.scenes ?? []).length > 1)
    return (canvas.scenes ?? []).flatMap((s) => s.elements ?? []);
  const scene = canvas.scenes.find((s) => s.id === canvas.activeSceneId) ?? canvas.scenes[0];
  return scene?.elements ?? [];
};




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
  const mode: AdventureMode = adventureModeOf(canvas);
  // Video Adventure: every scene is a Checkpoint and must be preserved as-is.
  if (canvas.video?.path && Array.isArray(canvas.scenes)) {
    const scenes = canvas.scenes.map((s, i) => ({
      ...makeScene(i),
      ...s,
      title: s.title || `Checkpoint ${i + 1}`,
      tag: s.tag ?? "",
      cameraTargetId: s.cameraTargetId ?? null,
      elements: (s.elements ?? []).map(withElementDefaults),
    }));
    return {
      mode,
      scenes,
      activeSceneId: canvas.activeSceneId ?? scenes[0]?.id ?? null,
      heightUnits: 1,
      narrations: narrationsOf(canvas),
      video: {
        ...canvas.video,
        source: canvas.video.source ?? "storage",
        muted: canvas.video.muted ?? true,
      },
    };
  }
  if (Array.isArray(canvas.scenes) && canvas.scenes.length > 0) {
    const scenes = canvas.scenes;
    if (scenes.length > 1) {
      // New format (`mode` present): several Scenes are real play stages and
      // must be preserved exactly as authored.
      if (canvas.mode) {
        const staged = scenes.map((s, i) => ({
          ...makeScene(i),
          ...s,
          title: s.title || `Scene ${i + 1}`,
          tag: s.tag ?? "",
          cameraTargetId: s.cameraTargetId ?? null,
          elements: (s.elements ?? []).map(withElementDefaults),
        }));
        return {
          mode,
          scenes: staged,
          activeSceneId: canvas.activeSceneId ?? staged[0]?.id ?? null,
          heightUnits: 1,
        };
      }
      // Legacy multi-scene: flatten into one continuous vertical canvas.
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
      return { mode, scenes: [single], activeSceneId: single.id, heightUnits: N };
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
      mode,
      scenes: [single],
      activeSceneId: single.id,
      heightUnits: Math.max(1, Math.floor(Number(canvas.heightUnits) || 1)),
    };
  }
  // Legacy: wrap flat elements into one scene.
  const legacy = (canvas.elements ?? []).map(withElementDefaults);
  const scene = { ...makeScene(0), elements: legacy };
  return { mode, scenes: [scene], activeSceneId: scene.id, heightUnits: 1 };
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

// ─────────────────────────────────────────────────────────────────────────────
// Fixed two-bar architecture
//
// Every Scene (Adventure) and every Learning Point (Video Adventure) owns
// exactly two Progress Bars: one Time Progress Bar and one Learning Progress
// Bar. Legacy games keep whatever bars they already have — the rule is only
// enforced when new bars are added.
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_BAR_LABEL = "Time Progress Bar";
export const LEARNING_BAR_LABEL = "Progress Bar";

/** Selectable countdown lengths for the Time Progress Bar (0 = No Time). */
export const TIME_DURATION_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "None" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 1200, label: "20 minutes" },
  { seconds: 1800, label: "30 minutes" },
];

/** Selectable Required Mark values for a Learning Point challenge. */
export const REQUIRED_MARK_OPTIONS: number[] = [40, 50, 60, 80, 100];

export const VIDEO_TIME_REQUIRED_MESSAGE =
  "A Video Adventure requires a Time Progress Bar for each Learning Point. Please set a duration before publishing your adventure.";

export const roleOf = (el: CanvasElement): BarRole => el.progress?.role ?? "learning";

export const isTimeBar = (el: CanvasElement): boolean =>
  el.kind === "progress_bar" && roleOf(el) === "time";

export const isLearningBar = (el: CanvasElement): boolean =>
  el.kind === "progress_bar" && roleOf(el) === "learning";

/**
 * The reserved Time Progress Bar of a Learning Point / Scene.
 *
 * Legacy adventures were authored before bars carried a role, so nothing is
 * marked `time` there. The architecture reserves the FIRST Progress Bar of
 * every Learning Point for the countdown, so when no bar is explicitly marked
 * we infer it from position. Read-time only — no canvas is rewritten.
 */
export const reservedTimeBarOf = (els: CanvasElement[]): CanvasElement | null => {
  const explicit = els.find(isTimeBar);
  if (explicit) return explicit;
  return els.find((el) => el.kind === "progress_bar") ?? null;
};

/** Progress Bars of a Learning Point that may receive a Lesson Note. */
export const questionBarsOf = (els: CanvasElement[]): CanvasElement[] => {
  const reserved = reservedTimeBarOf(els);
  return els.filter((el) => el.kind === "progress_bar" && el.id !== reserved?.id);
};

export const timeBarOf = (els: CanvasElement[]): CanvasElement | null =>
  reservedTimeBarOf(els);

export const learningBarOf = (els: CanvasElement[]): CanvasElement | null =>
  questionBarsOf(els)[0] ?? null;

/** Which bar may still be added, or null when both already exist. */
export const nextBarRole = (els: CanvasElement[]): BarRole | null => {
  if (!els.some(isTimeBar)) return "time";
  if (!els.some(isLearningBar)) return "learning";
  return null;
};

/** Countdown seconds configured for a scene (0 = No Time). */
export const sceneTimeSeconds = (scene: Scene | null | undefined): number => {
  const bar = scene ? timeBarOf(scene.elements) : null;
  return Math.max(0, Math.round(Number(bar?.progress?.timeDurationSeconds) || 0));
};

/** Learning Points of a Video Adventure that still have No Time set. */
export const checkpointsMissingTime = (canvas: GameCanvas): Scene[] =>
  (canvas.scenes ?? []).filter((s) => sceneTimeSeconds(s) <= 0);
