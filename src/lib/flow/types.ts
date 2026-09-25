export type SceneType = "base" | "emotion" | "flow_out" | "flow_in";

export interface FlowClip {
  id: string;
  path: string;
  name: string;
  duration: number;
  removeBg: boolean;
  keyColor?: { r: number; g: number; b: number } | null;
  /** AI cut-out: stacked WebM (colour on top, matte below). */
  processedPath?: string | null;
  /** Keep/remove brush PNG. */
  refineMaskPath?: string | null;
  /** Alpha/matte edge tightness. */
  edgeStrength?: EdgeStrength;
  /** How this clip carries transparency: real alpha, baked checkerboard, none. */
  transparency?: "alpha" | "checker" | "opaque" | null;
}

export type EdgeStrength = "soft" | "normal" | "tight";

/** A scene only stores its END point; start = previous scene's end. */
export interface FlowScene {
  id: string;
  end: number;
  name: string;
  type: SceneType;
  /** Emotion display: emoji icon + which to show. */
  emoji?: string;
  display?: "emoji" | "text";
}

export interface TrailSettings {
  color: string;
  length: number; // 0..1
  thickness: number; // 0..1
  glow: number; // 0..1
  vibration: number; // 0..1
  fadeSec: number; // shrink duration
}

export interface FlowPosition {
  /** Offset inside the permitted area, fractions -0.5..0.5 of the area. */
  dx: number;
  dy: number;
  /** Character size multiplier (0.3..10). */
  scale?: number;
  /** Universal Flow volume 0..1 (stored inside position jsonb). */
  volume?: number;
  /** Free Smartboard placement (centre as viewport fractions + scale). */
  character?: { x: number; y: number; scale: number };
  emotionBar?: { x: number; y: number; scale: number };
  /** Emotion control strip background selected in Flow setup. */
  emotionBackground?: string;
  /** When the Smartboard trail shows: only with # (solution) or always. */
  trailMode?: "solution" | "always";
}

export type FlowScope = "mathgpl" | "personal";

export interface FlowConfig {
  id: string;
  /** @deprecated alias of id (kept for older call sites). */
  notebook_id: string;
  owner_id: string;
  name: string;
  scope: FlowScope;
  status: "draft" | "published";
  cover_path: string | null;
  cover_type: "image" | "video" | null;
  /** Lesson-note level ON/OFF (from notebooks.flow_enabled). */
  enabled: boolean;
  clips: FlowClip[];
  scenes: FlowScene[];
  trail: TrailSettings;
  position: FlowPosition;
}

export const TRAIL_PRESETS: { name: string; color: string }[] = [
  { name: "Blue", color: "#3b9dff" },
  { name: "Purple", color: "#a45bff" },
  { name: "Gold", color: "#f5b93a" },
  { name: "Green", color: "#2ee08a" },
  { name: "Pink", color: "#ff5fb4" },
  { name: "Orange", color: "#ff8a2e" },
];

export const DEFAULT_TRAIL: TrailSettings = {
  color: "#3b9dff",
  length: 0.5,
  thickness: 0.5,
  glow: 0.6,
  vibration: 0.3,
  fadeSec: 1.5,
};

export const IDLE_MS = 10000;
