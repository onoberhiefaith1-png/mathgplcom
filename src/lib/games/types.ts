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

export interface TintSettings {
  color: string;
  strength: number;
  direction: TintDirection;
  softness: number;
}

export type ProgressFillStyle = "plain" | "effect";

export type SlantAxisDir = "left" | "right";
export type TiltDir = "in" | "out";
/** @deprecated legacy single-direction slant; kept for migration. */
export type SlantDirection = "left" | "right" | "in" | "out";

export interface SlantAxis<D extends string> {
  dir: D;
  amount: number;
}

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
  amplitude: number;
  speed: number;
  loop: boolean;
  delay?: number;
  fadeIn?: number;
  fadeOut?: number;
  trigger?: MotionTrigger;
}

export interface SlotEffect {
  fill?: ProgressFillStyle;
  plainColor?: string;
  effectAssetId?: string;
  effectStoragePath?: string;
  effectMediaType?: MediaType;
  effectSource?: MediaSource;
}

export interface ProgressConfig {
  segments: number;
  presetId?: string;
  totalMarks: number;
  currentMarks: number;
  effectAssetId?: string;
  effectStoragePath?: string;
  effectMediaType?: MediaType;
  effectSource?: MediaSource;
  slotEffects?: Record<number, SlotEffect>;
  fillStyle?: ProgressFillStyle;
  plainColor?: string;
  questionNotebookId?: string;
  questionSectionId?: string;
  /**
   * Teacher-set progress goal as a percentage of Grand Total (Phase 2 seam).
   * Grand Total = totalMarks × currentActiveStudents.
   * Required Score = Grand Total × progressGoalPct/100. Defaults to 100.
   */
  progressGoalPct?: number;
  fill: number;
  glow: number;
  effectScale: number;
}

export const progressFill = (p: ProgressConfig): number => {
  const total = p.totalMarks > 0 ? p.totalMarks : 1;
  return Math.min(1, Math.max(0, p.currentMarks / total));
};

export interface CanvasElement {
  id: string;
  kind: AssetKind;
  assetId: string;
  mediaType: MediaType;
  storagePath: string;
  source?: MediaSource;
  x: number;
  y: number;
  scale: number;
  z: number;
  rotation: number;
  opacity: number;
  animation: AnimationSettings;
  progress?: ProgressConfig;
  blend?: BlendMode;
  bgRemoval?: BgRemoval;
  keyColor?: { r: number; g: number; b: number };
  keyTolerance?: number;
  tint?: TintSettings;
  slant?: SlantSettings;
  label?: string;
}

export interface Scene {
  id: string;
  title: string;
  tag: string;
  elements: CanvasElement[];
  cameraTargetId?: string | null;
}

export interface GameCanvas {
  scenes: Scene[];
  activeSceneId?: string | null;
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

export const normalizeCanvas = (raw: unknown): GameCanvas => {
  const canvas = (raw ?? {}) as GameCanvas;
  if (Array.isArray(canvas.scenes) && canvas.scenes.length > 0) {
    return {
      scenes: canvas.scenes.map((s, i) => ({
        cameraTargetId: null,
        tag: "",
        title: `Scene ${i + 1}`,
        ...s,
        elements: (s.elements ?? []).map(withElementDefaults),
      })),
      activeSceneId: canvas.activeSceneId ?? canvas.scenes[0].id,
    };
  }
  const legacy = (canvas.elements ?? []).map(withElementDefaults);
  const scene = { ...makeScene(0), elements: legacy };
  return { scenes: [scene], activeSceneId: scene.id };
};

export const defaultTint = (): TintSettings => ({
  color: "#3aa0ff",
  strength: 0,
  direction: "even",
  softness: 0.5,
});

export const defaultSlant = (): SlantSettings => ({
  lean: { dir: "left", amount: 0 },
  slide: { dir: "left", amount: 0 },
  tilt: { dir: "in", amount: 0 },
});

export const migrateSlant = (raw: unknown): SlantSettings => {
  const base = defaultSlant();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<SlantSettings> & { direction?: SlantDirection; amount?: number };
  if (s.lean || s.slide || s.tilt) {
    return {
      lean: { ...base.lean, ...s.lean },
      slide: { ...base.slide, ...s.slide },
      tilt: { ...base.tilt, ...s.tilt },
    };
  }
  if (s.direction && typeof s.amount === "number") {
    if (s.direction === "left" || s.direction === "right") {
      base.lean = { dir: s.direction, amount: s.amount };
    } else {
      base.slide = { dir: s.direction === "in" ? "left" : "right", amount: s.amount };
    }
  }
  return base;
};

export const withElementDefaults = (el: CanvasElement): CanvasElement => ({
  blend: "normal",
  bgRemoval: "none",
  ...el,
  animation: { ...defaultAnimation(), ...(el.animation ?? {}) },
  slant: el.slant ? migrateSlant(el.slant) : undefined,
  progress: el.progress
    ? {
        segments: 10,
        totalMarks: 400,
        currentMarks: Math.round((el.progress.fill ?? 0) * (el.progress.totalMarks ?? 400)),
        fill: 0,
        glow: 0.5,
        effectScale: 1,
        fillStyle: "plain",
        ...el.progress,
      }
    : undefined,
});

export const GAME_ASSETS_BUCKET = "game-assets";
