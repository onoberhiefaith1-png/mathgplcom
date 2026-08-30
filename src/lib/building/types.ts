/**
 * EDITABLE 3D BUILDING — data contract.
 *
 * A Building is the environment shell around the Academy content: surface
 * designs (walls / floor / roof / door), lighting, effects, a walkway graph
 * (segments that extend forward and branch left/right) and doors placed along
 * walkways that open existing products. Products are never duplicated — a door
 * stores the product's kind and id, exactly like academy placements.
 *
 * The database is the source of truth; the 3D renderer is only a view of it.
 */

export type SurfaceKey = "leftWall" | "rightWall" | "floor" | "roof";

export interface SurfaceTextureRef {
  /** storage object path inside the game-assets bucket */
  path: string;
}

export interface SurfaceDesign {
  preset: string;
  color: string;
  texture: SurfaceTextureRef | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  repeat: boolean;
}

export interface DoorDesign {
  preset: string;
  color: string;
  texture: SurfaceTextureRef | null;
  /** 0.5 – 2, 1 = normal */
  brightness: number;
}

export interface LightingSettings {
  /** overall multiplier applied to every light */
  brightness: number;
  ambient: number;
  intensity: number;
  atmosphere: boolean;
}

export interface EffectsSettings {
  enabled: boolean;
  effect: string | null;
}

export interface EnvironmentSettings {
  leftWall: SurfaceDesign;
  rightWall: SurfaceDesign;
  floor: SurfaceDesign;
  roof: SurfaceDesign;
  door: DoorDesign;
  lighting: LightingSettings;
  effects: EffectsSettings;
}

export type WalkwayDirection = "forward" | "left" | "right";

export interface Building {
  id: string;
  org_id: string | null;
  owner_id: string;
  name: string;
  source_building_id: string | null;
  environment: EnvironmentSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildingWalkway {
  id: string;
  building_id: string;
  parent_id: string | null;
  direction: WalkwayDirection;
  length: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export type DoorContentKind = "course" | "game" | "adventure" | "assessment";

export interface BuildingDoor {
  id: string;
  building_id: string;
  walkway_id: string;
  position_along: number;
  design: DoorDesign;
  content_kind: DoorContentKind | null;
  content_id: string | null;
  title_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildingData {
  building: Building;
  walkways: BuildingWalkway[];
  doors: BuildingDoor[];
  canEdit: boolean;
}

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  leftWall: { preset: "academic", color: "#3a4763", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false },
  rightWall: { preset: "academic", color: "#3a4763", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false },
  floor: { preset: "classroom", color: "#232c3d", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false },
  roof: { preset: "neutral", color: "#141a26", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false },
  door: { preset: "modern", color: "#1a2542", texture: null, brightness: 1 },
  lighting: { brightness: 1, ambient: 0.6, intensity: 1.1, atmosphere: false },
  effects: { enabled: false, effect: null },
};

/** Available environmental effects (framework — more can be added later). */
export const EFFECT_OPTIONS: { value: string; label: string }[] = [
  { value: "soft-particles", label: "Soft particles" },
  { value: "sun-beams", label: "Sun beams" },
];

export const DIRECTION_LABEL: Record<WalkwayDirection, string> = {
  forward: "Forward",
  left: "Left branch",
  right: "Right branch",
};

export const DOOR_KIND_LABEL: Record<DoorContentKind, string> = {
  course: "Course",
  game: "Game",
  adventure: "Adventure",
  assessment: "Assessment",
};