// Room registry. Each entry is a complete fixed-camera 3D environment that
// hosts one physical slate. Adding a room = adding one entry here.
//
// Colour comes from the scanned material and from the lights. Tints are
// gentle multipliers only — never a flat wash of one hue over the room.

import stoneWall from "@/assets/slate/surfaces/stone-wall.jpg";
import stoneTablet from "@/assets/slate/surfaces/stone-tablet.jpg";
import wood from "@/assets/slate/surfaces/wood.jpg";
import metalPlate from "@/assets/slate/surfaces/metal-plate.jpg";
import glass from "@/assets/slate/surfaces/glass.jpg";
import ice from "@/assets/slate/surfaces/ice.jpg";
import type { EnvMood, PbrFamily } from "./pbr";

export type RoomProps =
  | "pillars"
  | "tablet-stands"
  | "timber"
  | "door-frame"
  | "forge"
  | "shelves"
  | "chests"
  | "armour"
  | "crystals"
  | "ice-formations";

export interface RoomLight {
  position: [number, number, number];
  colour: string;
  intensity: number;
  /** 0 = steady, 1 = strong flicker. */
  flicker: number;
  /** Draws a visible flame/emitter at the light position. */
  emitter: "flame" | "orb" | "none";
}

export interface RoomDef {
  id: string;
  label: string;
  /** Slate that physically lives in this room. */
  surfaceId: string;
  /** Legacy preview textures, kept for the surface picker. */
  wallTexture: string;
  floorTexture: string;
  /** Scanned PBR families used for the room shell. */
  wallFamily: PbrFamily;
  floorFamily: PbrFamily;
  wallTiling: [number, number];
  floorTiling: [number, number];
  wallTint: string;
  floorTint: string;
  ceilingTint: string;
  accent: string;
  /** Image-based lighting mood + how strongly it contributes. */
  env: { mood: EnvMood; intensity: number };
  /** Camera exposure for this room — the grade, not a saturation hack. */
  exposure: number;
  fog: { colour: string; near: number; far: number };
  ambient: { colour: string; intensity: number };
  key: { colour: string; intensity: number; position: [number, number, number] };
  lights: RoomLight[];
  props: RoomProps;
  particles: { colour: string; count: number; size: number; drift: number; opacity: number };
}

const torch = (
  x: number,
  colour = "#ff9a48",
  intensity = 9,
): RoomLight => ({ position: [x, 1.4, -3.2], colour, intensity, flicker: 0.85, emitter: "flame" });

export const ROOMS: RoomDef[] = [
  {
    id: "stone-temple",
    label: "Ancient Stone Temple",
    surfaceId: "stone-wall",
    wallTexture: stoneWall,
    floorTexture: stoneWall,
    wallFamily: "temple-stone",
    floorFamily: "stone-floor",
    wallTiling: [3, 1.8],
    floorTiling: [5, 5],
    wallTint: "#cdc6bb",
    floorTint: "#b8b1a6",
    ceilingTint: "#6f6a62",
    accent: "#ffb055",
    env: { mood: "warm", intensity: 0.35 },
    exposure: 1,
    fog: { colour: "#100c08", near: 11, far: 30 },
    ambient: { colour: "#4a4438", intensity: 0.32 },
    key: { colour: "#ffe3bd", intensity: 0.85, position: [3.5, 5.5, 3] },
    lights: [torch(-4.2), torch(4.2)],
    props: "pillars",
    particles: { colour: "#e8d7bb", count: 170, size: 0.028, drift: 0.14, opacity: 0.3 },
  },
  {
    id: "tablet-chamber",
    label: "Ancient Tablet Chamber",
    surfaceId: "stone-tablet",
    wallTexture: stoneTablet,
    floorTexture: stoneWall,
    wallFamily: "tablet-stone",
    floorFamily: "stone-floor",
    wallTiling: [3.4, 2],
    floorTiling: [5, 5],
    wallTint: "#c9c4bb",
    floorTint: "#b4ada2",
    ceilingTint: "#6b665e",
    accent: "#e2c489",
    env: { mood: "warm", intensity: 0.35 },
    exposure: 1.02,
    fog: { colour: "#0f0d09", near: 12, far: 32 },
    ambient: { colour: "#4b463b", intensity: 0.34 },
    key: { colour: "#ffeed2", intensity: 0.95, position: [-3, 5.5, 3.5] },
    lights: [torch(-4.4, "#ffa758", 11), torch(4.4, "#ffa758", 11)],
    props: "tablet-stands",
    particles: { colour: "#e6dcc6", count: 160, size: 0.026, drift: 0.11, opacity: 0.28 },
  },
  {
    id: "timber-cabin",
    label: "Wooden Forest Cabin",
    surfaceId: "wood",
    wallTexture: wood,
    floorTexture: wood,
    wallFamily: "wood",
    floorFamily: "dark-wood",
    wallTiling: [3, 2],
    floorTiling: [4, 4],
    wallTint: "#c2b6a6",
    floorTint: "#a2937f",
    ceilingTint: "#5d5347",
    accent: "#ffb257",
    env: { mood: "neutral", intensity: 0.4 },
    exposure: 1,
    fog: { colour: "#0d0a07", near: 11, far: 28 },
    ambient: { colour: "#4b4336", intensity: 0.34 },
    key: { colour: "#ffe6c4", intensity: 0.8, position: [2.5, 5, 4] },
    lights: [
      { position: [-4.6, 1.9, -4], colour: "#ffb968", intensity: 8, flicker: 0.45, emitter: "orb" },
      { position: [4.6, 1.9, -4], colour: "#ffb968", intensity: 8, flicker: 0.45, emitter: "orb" },
    ],
    props: "timber",
    particles: { colour: "#e9d9bd", count: 140, size: 0.026, drift: 0.12, opacity: 0.26 },
  },
  {
    id: "door-chamber",
    label: "Ancient Door Chamber",
    surfaceId: "door",
    wallTexture: stoneWall,
    floorTexture: stoneWall,
    wallFamily: "temple-stone",
    floorFamily: "stone-floor",
    wallTiling: [3, 1.8],
    floorTiling: [5, 5],
    wallTint: "#c4beb4",
    floorTint: "#aea79c",
    ceilingTint: "#655f57",
    accent: "#ffab3d",
    env: { mood: "warm", intensity: 0.3 },
    exposure: 0.98,
    fog: { colour: "#0e0a06", near: 10, far: 28 },
    ambient: { colour: "#463f34", intensity: 0.3 },
    key: { colour: "#ffdcb0", intensity: 0.8, position: [0, 5.6, 4] },
    lights: [torch(-3.9, "#ff8f34", 13), torch(3.9, "#ff8f34", 13)],
    props: "door-frame",
    particles: { colour: "#e3d2b6", count: 150, size: 0.028, drift: 0.13, opacity: 0.28 },
  },
  {
    id: "forge",
    label: "Forge / Metal Chamber",
    surfaceId: "metal-plate",
    wallTexture: stoneWall,
    floorTexture: metalPlate,
    wallFamily: "rust-metal",
    floorFamily: "metal-plate",
    wallTiling: [3.2, 2],
    floorTiling: [4, 4],
    wallTint: "#b7aca4",
    floorTint: "#a9a29d",
    ceilingTint: "#5a534e",
    accent: "#ff8a3c",
    env: { mood: "warm", intensity: 0.45 },
    exposure: 0.95,
    fog: { colour: "#0b0705", near: 10, far: 26 },
    ambient: { colour: "#42332a", intensity: 0.28 },
    key: { colour: "#ffc79b", intensity: 0.7, position: [-3, 5, 3] },
    lights: [
      { position: [-4.3, -1.2, -2.2], colour: "#ff5f14", intensity: 16, flicker: 1, emitter: "flame" },
      { position: [4.3, 1.4, -3], colour: "#ffa963", intensity: 6, flicker: 0.55, emitter: "orb" },
    ],
    props: "forge",
    particles: { colour: "#ff9e4d", count: 180, size: 0.034, drift: 0.42, opacity: 0.4 },
  },
  {
    id: "scroll-library",
    label: "Ancient Scroll Library",
    surfaceId: "scroll",
    wallTexture: wood,
    floorTexture: stoneTablet,
    wallFamily: "dark-wood",
    floorFamily: "stone-floor",
    wallTiling: [3.4, 2],
    floorTiling: [5, 5],
    wallTint: "#b6a893",
    floorTint: "#b0a99e",
    ceilingTint: "#564c40",
    accent: "#d8a45c",
    env: { mood: "neutral", intensity: 0.4 },
    exposure: 1.02,
    fog: { colour: "#0d0a07", near: 12, far: 30 },
    ambient: { colour: "#4a4234", intensity: 0.34 },
    key: { colour: "#ffeacb", intensity: 0.9, position: [2, 5.4, 3.6] },
    lights: [
      { position: [-4.8, 1.5, -4], colour: "#ffca8c", intensity: 7, flicker: 0.3, emitter: "orb" },
      { position: [4.8, 1.5, -4], colour: "#ffca8c", intensity: 7, flicker: 0.3, emitter: "orb" },
    ],
    props: "shelves",
    particles: { colour: "#ecdcc0", count: 180, size: 0.024, drift: 0.09, opacity: 0.3 },
  },
  {
    id: "treasure-chamber",
    label: "Treasure Chamber",
    surfaceId: "chest",
    wallTexture: stoneWall,
    floorTexture: stoneWall,
    wallFamily: "temple-stone",
    floorFamily: "stone-floor",
    wallTiling: [3, 1.8],
    floorTiling: [5, 5],
    wallTint: "#c6bfb2",
    floorTint: "#b0a99d",
    ceilingTint: "#645d53",
    accent: "#ffc447",
    env: { mood: "warm", intensity: 0.35 },
    exposure: 1,
    fog: { colour: "#0f0b06", near: 11, far: 29 },
    ambient: { colour: "#483f2f", intensity: 0.32 },
    key: { colour: "#ffe6ba", intensity: 0.85, position: [0, 5.4, 3.4] },
    lights: [
      torch(-4.1, "#ffa94a", 12),
      torch(4.1, "#ffa94a", 12),
      { position: [0, -2.2, -1.4], colour: "#ffcf63", intensity: 5, flicker: 0.2, emitter: "none" },
    ],
    props: "chests",
    particles: { colour: "#e8d6a8", count: 170, size: 0.028, drift: 0.16, opacity: 0.32 },
  },
  {
    id: "armoury",
    label: "Armour / Warrior Chamber",
    surfaceId: "shield",
    wallTexture: stoneWall,
    floorTexture: stoneTablet,
    wallFamily: "temple-stone",
    floorFamily: "stone-floor",
    wallTiling: [3, 1.8],
    floorTiling: [5, 5],
    wallTint: "#bfbcb4",
    floorTint: "#aaa79f",
    ceilingTint: "#5d5b55",
    accent: "#dcc27a",
    env: { mood: "neutral", intensity: 0.4 },
    exposure: 1,
    fog: { colour: "#0b0b09", near: 11, far: 29 },
    ambient: { colour: "#42403a", intensity: 0.32 },
    key: { colour: "#ffeacc", intensity: 0.95, position: [-2.6, 5.4, 3.6] },
    lights: [torch(-4.3, "#ffb672", 11), torch(4.3, "#ffb672", 11)],
    props: "armour",
    particles: { colour: "#ddd5c2", count: 150, size: 0.026, drift: 0.11, opacity: 0.26 },
  },
  {
    id: "glass-chamber",
    label: "Mystical Glass Chamber",
    surfaceId: "glass",
    wallTexture: glass,
    floorTexture: stoneTablet,
    wallFamily: "ice",
    floorFamily: "stone-floor",
    wallTiling: [2.4, 1.6],
    floorTiling: [5, 5],
    wallTint: "#b9c6cc",
    floorTint: "#a6adb2",
    ceilingTint: "#5a656c",
    accent: "#8fd8f0",
    env: { mood: "cool", intensity: 0.55 },
    exposure: 1.05,
    fog: { colour: "#070f14", near: 11, far: 30 },
    ambient: { colour: "#38454c", intensity: 0.3 },
    key: { colour: "#e6f3fb", intensity: 0.85, position: [0, 5.6, 3.6] },
    lights: [
      { position: [-4.8, 0.8, -4], colour: "#7fc9e8", intensity: 6, flicker: 0.25, emitter: "orb" },
      { position: [4.8, 0.8, -4], colour: "#7fc9e8", intensity: 6, flicker: 0.25, emitter: "orb" },
    ],
    props: "crystals",
    particles: { colour: "#dfeef5", count: 190, size: 0.026, drift: 0.18, opacity: 0.32 },
  },
  {
    id: "ice-cavern",
    label: "Ice Cavern",
    surfaceId: "ice",
    wallTexture: ice,
    floorTexture: ice,
    wallFamily: "ice",
    floorFamily: "ice",
    wallTiling: [2.6, 1.8],
    floorTiling: [4.5, 4.5],
    wallTint: "#c4d2da",
    floorTint: "#b6c5ce",
    ceilingTint: "#5f6f79",
    accent: "#7fd8ff",
    env: { mood: "cool", intensity: 0.6 },
    exposure: 1.02,
    fog: { colour: "#0a141b", near: 9, far: 26 },
    ambient: { colour: "#3b4a54", intensity: 0.3 },
    key: { colour: "#e8f4fb", intensity: 0.8, position: [1.5, 5.6, 3.6] },
    lights: [
      { position: [-4.2, 1, -2.8], colour: "#8ed3f2", intensity: 8, flicker: 0.2, emitter: "orb" },
      { position: [4.2, 1, -2.8], colour: "#8ed3f2", intensity: 8, flicker: 0.2, emitter: "orb" },
    ],
    props: "ice-formations",
    particles: { colour: "#eaf5fb", count: 200, size: 0.026, drift: 0.2, opacity: 0.35 },
  },
];

const FALLBACK = ROOMS[0] as RoomDef;

export const getRoom = (id: string | undefined): RoomDef =>
  ROOMS.find((room) => room.id === id) ?? FALLBACK;

export const roomForSurface = (surfaceId: string): RoomDef =>
  ROOMS.find((room) => room.surfaceId === surfaceId) ?? FALLBACK;
