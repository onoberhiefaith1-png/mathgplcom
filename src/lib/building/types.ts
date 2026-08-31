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

/**
 * The five surfaces of a hallway. "endWall" is the terminal wall at the far end
 * of a hallway that does not continue forward — it is edited exactly like the
 * other surfaces, so a hallway is never an undefined dark void.
 */
export type SurfaceKey = "leftWall" | "rightWall" | "floor" | "roof" | "endWall";

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
  /**
   * How an image is fitted to the surface, like a physical panel:
   * "cover" crops the excess and never distorts (default), "stretch" fills
   * the plane 1:1 (legacy behaviour).
   */
  fit: "cover" | "stretch";
}

export interface DoorDesign {
  preset: string;
  color: string;
  texture: SurfaceTextureRef | null;
  /** 0.5 – 2, 1 = normal */
  brightness: number;
  /** built-in door asset key (see lib/building/doors.ts) */
  style: string;
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
  /** Terminal wall at the far end of a hallway that does not continue. */
  endWall: SurfaceDesign;
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
  /** Editable hallway name ("Main Hallway", "Algebra Hallway"). */
  name: string;
  /**
   * Editable name of this hallway's ENDPOINT — the terminal navigation node at
   * its far end ("Building Exit" by default). Null means "use the default".
   */
  end_label: string | null;
  direction: WalkwayDirection;
  /**
   * Where along the PARENT hallway this branch leaves (0–1). A hallway is a
   * road and a branch is a perpendicular junction on it, not an extension.
   */
  junction_at: number;

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
  leftWall: { preset: "academic", color: "#3a4763", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false, fit: "cover" },
  rightWall: { preset: "academic", color: "#3a4763", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false, fit: "cover" },
  floor: { preset: "classroom", color: "#3b4658", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false, fit: "cover" },
  roof: { preset: "neutral", color: "#2c3448", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false, fit: "cover" },
  endWall: { preset: "academic", color: "#38445f", texture: null, scale: 1, offsetX: 0, offsetY: 0, repeat: false, fit: "cover" },
  door: { preset: "modern", color: "#1a2542", texture: null, brightness: 1, style: "navy-vision" },
  lighting: { brightness: 1, ambient: 0.8, intensity: 1.35, atmosphere: false },
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