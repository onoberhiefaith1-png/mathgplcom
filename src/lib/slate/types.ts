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
  /** Math Vault only: the teacher's short expression, kept obscured on the slate. */
  expression?: string;
  /** Math Vault only: what this particular Vault Code pays when it opens. */
  coins?: number;
  /** Math Vault only: the mathematical components that should open it. */
  targets?: string;
  /** Hidden effect code: what this effect reveals while it plays. */
  script?: string;
  /** Hourglass only: the time it holds, in milliseconds. */
  durationMs?: number;
}

export interface Slot {
  id: string;
  /** Writing surface for THIS line only; absent = the Game's own surface. */
  surfaceId?: string | null;
  /** Live player writing. Plain text today, external content provider later. */
  text: string;
  /** Pre-authored content that is concealed, never destroyed. */
  hiddenContent: string;
  contentState: ContentState;
  rewards: RewardInstance[];
  scene: SlotScene;
}

export interface BackgroundSettings {
  /** Bundled preset URL, or a legacy data URL from older saves. */
  src: string | null;
  /** Uploaded file kept in IndexedDB — saved games only store this id. */
  assetId?: string | null;
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
  /** Saved visual package for the separate Premium Spherical Chain Bomb. */
  premiumBombStyle: PremiumBombStyle;
}

export type PremiumBombStyle =
  | "solar-burst"
  | "golden-comet"
  | "rainbow-energy"
  | "royal-magic"
  | "crystal-pulse"
  | "firestorm"
  | "plasma-burst"
  | "star-explosion"
  | "arcane-spiral"
  | "radiant-chain";

/** The user's own sun / light effect, uploaded in the editor. */
export interface SunAsset {
  assetId: string;
  name: string;
  colour: string;
  intensity: number;
  glow: number;
  scale: number;
  loop: boolean;
}

/** One uploaded background music track. */
export interface AudioTrack {
  id: string;
  assetId: string;
  name: string;
  volume: number;
  loop: boolean;
}

export interface AssetSettings {
  sun: SunAsset | null;
  audio: AudioTrack[];
  activeTrackId: string | null;
  /** Optional per-room track choice, keyed by room id. */
  roomTrackIds: Record<string, string>;
}

/** Values the student keeps while playing this saved slate. */
export interface GameStatus {
  /** Math Vaults opened in this slate. */
  vaultsOpened: number;
  lives: number;
  /** Absolute timestamp; null means no timer is currently running. */
  timerEndsAt: number | null;
}

/** Time rewards are always a fraction of a time that already exists. */
export type TimeFraction = "full" | "half" | "third" | "quarter";

/**
 * Configuration owned by ONE Floating Numbers line. The mathematics itself
 * always stays in Floating Numbers — this is only how that line looks and
 * behaves inside the Game world.
 */
/** One Vault Code: a piece of mathematics that opens a Vault on this line. */
export interface VaultCode {
  /** The mathematics the Vault recognises, e.g. "x + 7". */
  expression: string;
  /** What this Vault pays when it opens. */
  reward: number;
}

export interface LineSurfaceConfig {
  /** Floating Numbers line id. The one and only shared identity. */
  lineId: string;
  /** Writing surface for this line; null = the Game's own surface. */
  surfaceId: string | null;
  /** How much of THIS line's own timer its Hourglass awards. */
  hourglassReward: TimeFraction;
  /** Up to ten Vault Codes owned by this line. */
  vaultCodes: VaultCode[];
  /** Legacy single-code configuration; read into vaultCodes on load. */
  vaultExpression?: string | null;
  vaultCoins?: number;
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
  /** Uploaded sun and background music. */
  assets: AssetSettings;
  /** Per-Floating-Numbers-line configuration, keyed by line id. */
  lines: Record<string, LineSurfaceConfig>;
  /** How much of the original question time a Life gives back. */
  life: { fraction: TimeFraction };
}

export interface Game {
  id: string;
  name: string;
  topic: string;
  subtopic: string;
  surfaceId: string;
  /** Teacher-selected colour for the Plain writing surface. */
  surfaceColour?: string;
  /** The 3D room this slate physically lives in. */
  roomId: string;
  background: BackgroundSettings;
  slots: Slot[];
  settings: GameSettings;
  status: GameStatus;
  /** MathGPL: how many Game Lines the repeating reward pattern covers. */
  patternLength: number;
  updatedAt: number;
}

export type EditorMode = "edit" | "view";

export type Selection =
  | { kind: "none" }
  | { kind: "slot"; slotId: string }
  | { kind: "reward"; slotId: string; rewardId: string };
