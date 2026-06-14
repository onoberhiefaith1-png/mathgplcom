export type SceneKind = "obstacle" | "door" | "vault";

export interface AdventureGame {
  id: string;
  owner_id: string;
  name: string;
  topic: string | null;
  subtopic: string | null;
  description: string | null;
  /** 1–8 override; null = auto-cycle by position */
  frame_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundRef {
  /** "library" = built-in adventure asset, "url" = uploaded/external */
  kind: "library" | "url";
  /** library id, or asset URL */
  ref: string;
  label?: string;
}

export type MotionType =
  | "static" | "left" | "right" | "up" | "down"
  | "circle" | "figure8" | "random" | "path";

export type PlaybackDirection = "forward" | "reverse" | "pingpong";
export type LoopMode = "forever" | "once" | "count";
export type BlendMode = "screen" | "normal" | "multiply" | "lighten";
export type TriggerEvent =
  | "always" | "sceneStart" | "questionSolved" | "obstacleCleared"
  | "doorOpened" | "vaultOpened" | "sceneComplete" | "custom";
export type ExitBehavior =
  | "instant" | "fade" | "shrink" | "explode" | "playExit" | "custom";

export interface EffectMotion {
  type: MotionType;
  speed: number;        // 0.25..8
  amplitude: number;    // 0..50 (% of frame)
  path?: { x: number; y: number }[];
}
export interface EffectPlayback {
  direction: PlaybackDirection;
  speed: number;            // 0.25..4
  loopMode: LoopMode;
  loopCount?: number;
  enterEnd?: number;        // seconds
  activeStart?: number;
  activeEnd?: number;
  exitStart?: number;
  freezeLastFrame: boolean;
}
export interface EffectTrigger {
  start: TriggerEvent;
  delay: number;            // seconds
  exitOn?: TriggerEvent;
  exitBehavior: ExitBehavior;
}

export interface LayoutItem {
  id: string;
  /** what this slot renders */
  kind: "effect" | "progress" | "vault";
  /** asset URL for effects/vault icons (optional) */
  src?: string;
  label?: string;
  /** percentages relative to the scene frame (0-100) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** for vault: vault_id linking questions */
  vaultId?: string;
  /** for vault: reward coins */
  reward?: number;
  // ---- effect-only (all optional, defaults applied at render) ----
  rotation?: number;        // degrees 0..360
  opacity?: number;         // 0..1
  zIndex?: number;
  blendMode?: BlendMode;
  motion?: EffectMotion;
  playback?: EffectPlayback;
  trigger?: EffectTrigger;
}

export interface SceneCamera {
  startX: number; startY: number;
  endX: number; endY: number;
  speed: number;            // seconds for full traverse
  zoomStart: number;        // 1 = no zoom
  zoomEnd: number;
}


export interface SceneLayout {
  items: LayoutItem[];
}

export interface AdventureScene {
  id: string;
  game_id: string;
  order_index: number;
  kind: SceneKind;
  title: string | null;
  background_ref: BackgroundRef | null;
  layout_json: SceneLayout;
  required_progress: number;
  config: Record<string, unknown>;
  /** Linked Game-Questions notebook (created on first "Questions" click). */
  notebook_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdventureSceneQuestion {
  id: string;
  scene_id: string;
  vault_id: string | null;
  order_index: number;
  question_payload: { prompt?: string; answer?: string; [k: string]: unknown };
  marks: number;
  claim_once: boolean;
  created_at: string;
  updated_at: string;
}
