// The original MathGPL building, expressed as a fixed list of artwork slots.
// Geometry (position, curve, perspective, radius, overlap, rotation) lives in the
// scene and never changes — a slot only ever swaps the artwork it paints.
import ring0 from "@/assets/adventure/mathgpl-ring-0.png.asset.json";
import ring2 from "@/assets/adventure/mathgpl-ring-2.png.asset.json";
import ring4 from "@/assets/adventure/mathgpl-ring-4.png.asset.json";
import ring6 from "@/assets/adventure/mathgpl-ring-6.png.asset.json";
import ring7 from "@/assets/adventure/mathgpl-ring-7.png.asset.json";
import mathgplPalace from "@/assets/adventure/mathgpl-palace.png.asset.json";
import centralDomeCore from "@/assets/adventure/central-dome-core.png.asset.json";
import freeBillboardPalace from "@/assets/adventure/free-billboard-palace.png.asset.json";

export type SlotGroup = "ring" | "core";

export interface BuildingSlot {
  id: string;
  label: string;
  group: SlotGroup;
  /** Original artwork shipped with the MathGPL building. */
  defaultUrl: string;
  /** Where a click on this ring segment travels (ring slots only). */
  route?: string;
}

/** Outer city ring — 8 curved segments, clockwise from the front. */
export const RING_SLOTS: BuildingSlot[] = [
  { id: "ring-0", label: "Ring 1 · Algebra", group: "ring", defaultUrl: ring0.url, route: "/subjects/algebra" },
  { id: "ring-1", label: "Ring 2 · MathGPL hub", group: "ring", defaultUrl: mathgplPalace.url, route: "/teaching-hub" },
  { id: "ring-2", label: "Ring 3 · Geometry", group: "ring", defaultUrl: ring2.url, route: "/subjects/geometry" },
  { id: "ring-3", label: "Ring 4 · MathGPL hub", group: "ring", defaultUrl: mathgplPalace.url, route: "/teaching-hub" },
  { id: "ring-4", label: "Ring 5 · Trigonometry", group: "ring", defaultUrl: ring4.url, route: "/subjects/trigonometry" },
  { id: "ring-5", label: "Ring 6 · MathGPL hub", group: "ring", defaultUrl: mathgplPalace.url, route: "/teaching-hub" },
  { id: "ring-6", label: "Ring 7 · Statistics", group: "ring", defaultUrl: ring6.url, route: "/subjects/statistics" },
  { id: "ring-7", label: "Ring 8 · Calculus", group: "ring", defaultUrl: ring7.url, route: "/subjects/calculus" },
];

/** Inner dome core — 8 artwork positions tiled around the palace core. */
export const CORE_SLOTS: BuildingSlot[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `core-${i}`,
  label: `Core dome ${i + 1}`,
  group: "core" as SlotGroup,
  defaultUrl: centralDomeCore.url,
}));

/** All 16 replaceable artwork slots of the original MathGPL building. */
export const BUILDING_SLOTS: BuildingSlot[] = [...RING_SLOTS, ...CORE_SLOTS];

/**
 * FREE BUILDING DEFAULTS
 *
 * The platform-owned Free/advertisement building ships with its own artwork for
 * the eight outer positions (the billboard palace). The eight inner core dome
 * slots are shared with the Pro building and are untouched.
 */
export type BuildingVersionKey = "pro" | "free";

export const defaultUrlFor = (slot: BuildingSlot, version: BuildingVersionKey): string =>
  version === "free" && slot.group === "ring" ? freeBillboardPalace.url : slot.defaultUrl;

/** The 16 slots as they appear for a given building version. */
export const slotsForVersion = (version: BuildingVersionKey): BuildingSlot[] =>
  BUILDING_SLOTS.map((slot) => ({ ...slot, defaultUrl: defaultUrlFor(slot, version) }));
