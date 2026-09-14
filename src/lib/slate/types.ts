// Core data model for the Game Slate prototype.
// Deliberately engine-agnostic: no mathematics logic lives here.

import type { TextSettings } from "./text3d";
export type { TextSettings };

export type ContentState = "hidden" | "visible" | "revealed" | "locked";

export type RewardState = "dormant" | "active" | "archived";

export type EnvironmentId =
  | "forest"
  | "ice-cavern"
  | "ancient-temple"
  | "volcanic-cavern"
  | "underwater-ruins"
  | "sky-realm"
  | "desert-ruins"
  | "crystal-cave"
  | "night-observatory"
  | "living-garden";

export type SceneMaterial = "wood" | "stone" | "metal" | "glass" | "ice" | "crystal" | "leather";
export type SceneColour = "natural" | "warm" | "cool" | "verdant" | "ember" | "celestial";
export type ReliefMode = "carved" | "raised" | "engraved" | "embossed" | "recessed";

export interface SlotScene {
  environmentId: EnvironmentId;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  depth: number;
  material: SceneMaterial;
  colour: SceneColour;
  relief: ReliefMode;
  lighting: number;
  animation: number;
  effectIntensity: number;
}

export interface RewardInstance {
  id: string;
  /** Reward type id from the reward registry. */
  type: string;
  state: RewardState;
  hidden: boolean;
  /** Position inside the slot, in percent of the slot box. */
  x: number;
  y: number;
  /** Per-object scene controls. Optional values are normalized for older drafts. */
  z?: number;
  scale?: number;
  rotation?: number;
  lighting?: number;
  animation?: number;
  effectIntensity?: number;
  material?: SceneMaterial;
  colour?: SceneColour;
  relief?: ReliefMode;
}

export interface Slot {
  id: string;
  /** Live player writing. Plain text today, external content provider later. */
  text: string;
  /** Pre-authored content that is concealed, never destroyed. */
  hiddenContent: string;
  contentState: ContentState;
  rewards: RewardInstance[];
  scene: SlotScene;
}

export interface BackgroundSettings {
  /** Data URL or bundled asset URL. */
  src: string | null;
  kind: "image" | "video";
  scale: number;
  x: number;
  y: number;
  opacity: number;
}

export interface SlateSettings {
  scale: number;
  width: number;
  slotSpacing: number;
  slotMinHeight: number;
  slotPadding: number;
}

export interface WritingSettings {
  size: number;
  depth: number;
  bevel: number;
  shadow: number;
  highlight: number;
  opacity: number;
  /** Overrides the surface's default treatment when set. */
  style: "material" | "carved" | "raised";
}

/** The small engraved marker that numbers each writing area. */
export interface NumberSettings {
  visible: boolean;
  /** null = take the material's own ink. */
  colour: string | null;
  opacity: number;
  size: number;
  depth: number;
  bevel: number;
  shadow: number;
  contrast: number;
  align: "left" | "right";
  vertical: "top" | "middle";
  relief: "auto" | "engraved" | "carved" | "raised";
  swatches?: string[];
}

export interface RewardSettings {
  visible: boolean;
  opacity: number;
  glow: number;
  scale: number;
}

export interface EffectSettings {
  speed: number;
  glow: number;
  particles: number;
  duration: number;
  testMode: boolean;
}

/** Values the student keeps while playing this saved slate. */
export interface GameStatus {
  coins: number;
  lives: number;
  /** Absolute timestamp; null means no timer is currently running. */
  timerEndsAt: number | null;
}

export interface GameSettings {
  slate: SlateSettings;
  writing: WritingSettings;
  /** Live 3D text renderer settings. */
  text: TextSettings;
  /** Engraved section markers. */
  numbers: NumberSettings;
  rewards: RewardSettings;
  effects: EffectSettings;
}

export interface Game {
  id: string;
  name: string;
  topic: string;
  subtopic: string;
  surfaceId: string;
  /** The 3D room this slate physically lives in. */
  roomId: string;
  background: BackgroundSettings;
  /** The Lines that make up the repeating reward pattern. */
  slots: Slot[];
  /** How many Lines the reward pattern is long. Defaults to slots.length. */
  patternLength?: number;
  settings: GameSettings;
  status: GameStatus;
  updatedAt: number;
}

export type EditorMode = "edit" | "view";

export type Selection =
  | { kind: "none" }
  | { kind: "slot"; slotId: string }
  | { kind: "reward"; slotId: string; rewardId: string };
