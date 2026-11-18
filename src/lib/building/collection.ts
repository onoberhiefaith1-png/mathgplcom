/**
 * THE TEN-BUILDING COLLECTION — complete, editable buildings for the Public
 * (official) gallery.
 *
 * Pure data, no React and no database: the installer (a single Postgres
 * function, see supabase/migrations/20261118120000_ten_building_collection.sql)
 * receives these blueprints and writes ordinary building rows, so after
 * install every hallway, room, screen, frame, surface and exterior slot is
 * edited with the normal Building tools.
 *
 * Exterior artwork: public/building-collection/<slug>-{exterior,core}.webp
 * (one ring picture for the 8 outer slots, one core picture for the 8 inner
 * slots). Interior artwork: bundled `builtin:<slug>-{wall,floor,ceiling}`
 * samples (src/lib/building/collectionSurfaces.ts), tiled at their own
 * proportions so long corridor walls are never stretched.
 */
import { DEFAULT_ENVIRONMENT, type ClassroomKind, type EnvironmentSettings, type SurfaceDesign } from "./types";

export type CollectionEra = "Ancient" | "Heritage" | "Modern" | "Future";

export interface CollectionTheme {
  slug: string;
  name: string;
  era: CollectionEra;
  description: string;
  /** Plaster colour shown while the wall art loads, and on untextured trims. */
  color: string;
  door: string;
}

export const BUILDING_COLLECTION: readonly CollectionTheme[] = [
  { slug: "nile-sun-palace", name: "Nile Sun Palace", era: "Ancient", color: "#d6bd83", door: "oak-vision",
    description: "Sandstone colonnades, lotus columns and painted friezes beside the river." },
  { slug: "aegean-academy", name: "Aegean Academy", era: "Ancient", color: "#e9e2cf", door: "navy-vision",
    description: "White marble halls with blue meander borders, overlooking the sea." },
  { slug: "andalusian-courtyard", name: "Andalusian Courtyard", era: "Ancient", color: "#ddc49a", door: "oak-vision",
    description: "Horseshoe arches, zellige tiles and carved cedar around a garden court." },
  { slug: "meridian-dome-palace", name: "Meridian Dome Palace", era: "Ancient", color: "#e7e3d5", door: "glass-entrance",
    description: "A domed marble palace with inlaid stone floors and gilded coffers." },
  { slug: "heritage-clock-hall", name: "Heritage Clock Hall", era: "Heritage", color: "#b99160", door: "oak-vision",
    description: "A red-brick school hall with oak panelling and a clock tower." },
  { slug: "glass-garden-campus", name: "Glass Garden Campus", era: "Modern", color: "#e2d6b9", door: "glass-entrance",
    description: "Timber, glass and planted terraces in a bright modern campus." },
  { slug: "horizon-sails-institute", name: "Horizon Sails Institute", era: "Modern", color: "#e8e6db", door: "glass-entrance",
    description: "White sail roofs over light concrete and glass learning wings." },
  { slug: "aurora-sky-academy", name: "Aurora Sky Academy", era: "Future", color: "#c7d7ef", door: "charcoal-full-glass",
    description: "A floating academy of white panels and soft blue light lines." },
  { slug: "verdant-arcology", name: "Verdant Arcology", era: "Future", color: "#d2dfc7", door: "glass-entrance",
    description: "A green future city building with living walls and timber decks." },
  { slug: "celestial-observatory", name: "Celestial Observatory", era: "Future", color: "#263554", door: "charcoal-vision",
    description: "A night-sky observatory with star-map panels and dark blue domes." },
];

export const COLLECTION_SLUGS = BUILDING_COLLECTION.map((t) => t.slug);

/** Gallery category for each era (seeded categories in the gallery migration). */
export const ERA_CATEGORY: Record<CollectionEra, string> = {
  Ancient: "ancient",
  Heritage: "school",
  Modern: "modern",
  Future: "futuristic",
};

export const collectionSurfaceKey = (slug: string, part: "wall" | "floor" | "ceiling") => `${slug}-${part}`;

export function collectionEnvironment(theme: CollectionTheme): EnvironmentSettings {
  const surface = (part: "wall" | "floor" | "ceiling", color: string, tiles: number): SurfaceDesign => ({
    ...DEFAULT_ENVIRONMENT.leftWall,
    color,
    texture: { path: `builtin:${collectionSurfaceKey(theme.slug, part)}` },
    // "tile": `scale` copies floor-to-ceiling on walls / across the width on
    // floors and ceilings, repeated along the length at the art's own aspect.
    fit: "tile",
    repeat: true,
    scale: tiles,
  });
  return {
    leftWall: surface("wall", theme.color, 1),
    rightWall: surface("wall", theme.color, 1),
    startWall: surface("wall", theme.color, 1),
    endWall: surface("wall", theme.color, 1),
    floor: surface("floor", "#d7d9df", 2),
    roof: surface("ceiling", "#eeece5", 2),
    door: { ...DEFAULT_ENVIRONMENT.door, style: theme.door },
    lighting: { brightness: 1, ambient: 0.85, intensity: 1.35, atmosphere: false },
    effects: { enabled: false, effect: null },
  };
}

export interface CollectionHallway {
  key: string;
  parent: string | null;
  name: string;
  direction: "forward" | "left" | "right";
  /** Where on the parent this hallway opens (0–1); forward continuations sit at the end. */
  junction: number;
  length: number;
  end: string;
}

/** Parent-first. Branch openings and doors use separate order slots. */
export const COLLECTION_HALLWAYS: readonly CollectionHallway[] = [
  { key: "entrance", parent: null, name: "Welcome Gallery", direction: "forward", junction: 0.02, length: 32, end: "Learning Concourse" },
  { key: "east", parent: "entrance", name: "Discovery Wing", direction: "right", junction: 0.04, length: 24, end: "Discovery Wing End" },
  { key: "west", parent: "entrance", name: "Scholar Wing", direction: "left", junction: 0.08, length: 24, end: "Scholar Wing End" },
  { key: "concourse", parent: "entrance", name: "Learning Concourse", direction: "forward", junction: 1, length: 32, end: "Celebration Gallery" },
  { key: "studio", parent: "concourse", name: "Innovation Wing", direction: "right", junction: 0.04, length: 24, end: "Innovation Wing End" },
  { key: "library", parent: "concourse", name: "Reflection Wing", direction: "left", junction: 0.08, length: 24, end: "Reflection Wing End" },
  { key: "finish", parent: "concourse", name: "Celebration Gallery", direction: "forward", junction: 1, length: 20, end: "Building Exit" },
];

export interface CollectionRoom {
  hallway: string;
  name: string;
  kind: ClassroomKind;
  /** Door position along its hallway (order slot, 0–1). */
  offset: number;
}

export const COLLECTION_ROOMS: readonly CollectionRoom[] = [
  { hallway: "entrance", name: "Welcome Classroom", kind: "classroom", offset: 0.02 },
  { hallway: "east", name: "Discovery Classroom", kind: "classroom", offset: 0.02 },
  { hallway: "east", name: "Exploration Hall", kind: "teaching_hall", offset: 0.04 },
  { hallway: "west", name: "Scholar Classroom", kind: "classroom", offset: 0.02 },
  { hallway: "west", name: "Seminar Hall", kind: "teaching_hall", offset: 0.04 },
  { hallway: "concourse", name: "Main Auditorium", kind: "auditorium", offset: 0.02 },
  { hallway: "studio", name: "Creative Studio", kind: "classroom", offset: 0.02 },
  { hallway: "studio", name: "Innovation Hall", kind: "teaching_hall", offset: 0.04 },
  { hallway: "library", name: "Reading Room", kind: "classroom", offset: 0.02 },
  { hallway: "library", name: "Reflection Classroom", kind: "classroom", offset: 0.04 },
  { hallway: "finish", name: "Celebration Auditorium", kind: "auditorium", offset: 0.02 },
];

/** Each room gets one screen and these two frames. */
export const COLLECTION_ROOM_FRAMES = [
  { wall: "leftWall", suffix: "Assignments", offsetAlong: 0.3 },
  { wall: "rightWall", suffix: "Adventures", offsetAlong: 0.7 },
] as const;

export const collectionArtwork = (slug: string) => ({
  exterior: `/building-collection/${slug}-exterior.webp`,
  core: `/building-collection/${slug}-core.webp`,
});

export const frameDesignFor = (era: CollectionEra) =>
  era === "Future" ? "scifi-steel" : era === "Modern" ? "brass-walnut" : "royal-gold";

export function collectionBlueprint(theme: CollectionTheme, artwork = collectionArtwork(theme.slug)) {
  const slot = (path: string) => ({ source: "url" as const, mediaType: "image" as const, path });
  return {
    slug: theme.slug,
    name: theme.name,
    era: theme.era,
    description: theme.description,
    category: ERA_CATEGORY[theme.era],
    environment: collectionEnvironment(theme),
    exterior: {
      buildingMode: "mathgpl" as const,
      buildingSpeed: 0.6,
      slotOverrides: Object.fromEntries([
        ...Array.from({ length: 8 }, (_, n) => [`ring-${n}`, slot(artwork.exterior)]),
        ...Array.from({ length: 8 }, (_, n) => [`core-${n}`, slot(artwork.core)]),
      ]) as Record<string, ReturnType<typeof slot>>,
    },
    thumbnail: artwork.exterior,
    hallways: COLLECTION_HALLWAYS,
    rooms: COLLECTION_ROOMS,
    frameDesign: frameDesignFor(theme.era),
  };
}

export type CollectionBlueprint = ReturnType<typeof collectionBlueprint>;

export interface CollectionInstallRow {
  slug: string;
  name: string;
  /** The administrator's own editable copy (Mine). */
  buildingId: string;
  created: boolean;
  /** The frozen gallery template behind the Public entry. */
  templateId: string;
  templateCreated: boolean;
  entryId: string;
  /** True only when this run published the Public entry. */
  published: boolean;
}
