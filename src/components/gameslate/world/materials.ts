// Procedural surface detail. Real materials need more than a colour map:
// these generate the normal / roughness variation that makes stone read as
// stone and metal read as metal under the room's lights.

import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

const makeCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

/** Value noise heightfield -> tangent-space normal map. */
export function noiseNormalMap(key: string, strength = 1, grain = 64): THREE.Texture {
  const id = `n:${key}:${strength}:${grain}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) height[i] = Math.random();
  // cheap smoothing pass so the noise has structure, not TV static
  const smooth = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = (x + dx + size) % size;
          const sy = (y + dy + size) % size;
          sum += height[sy * size + sx] ?? 0;
          n++;
        }
      }
      const coarse = Math.sin((x / size) * grain) * Math.cos((y / size) * grain * 0.7) * 0.18;
      smooth[y * size + x] = sum / n + coarse;
    }
  }

  const at = (x: number, y: number) => smooth[((y + size) % size) * size + ((x + size) % size)] ?? 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * 6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength * 6;
      const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
      const index = (y * size + x) * 4;
      image.data[index] = (normal.x * 0.5 + 0.5) * 255;
      image.data[index + 1] = (normal.y * 0.5 + 0.5) * 255;
      image.data[index + 2] = (normal.z * 0.5 + 0.5) * 255;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  cache.set(id, texture);
  return texture;
}

/** Streaky wear / scratch map, used as a roughness map on metal and ice. */
export function scratchMap(key: string, density = 220, contrast = 0.55): THREE.Texture {
  const id = `s:${key}:${density}:${contrast}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const base = Math.round(255 * contrast);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < density; i++) {
    const bright = Math.random() > 0.5;
    ctx.strokeStyle = bright ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.random() * 1.6 + 0.2;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = Math.random() * Math.PI;
    const length = 12 + Math.random() * 90;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  cache.set(id, texture);
  return texture;
}

export interface MaterialRecipe {
  roughness: number;
  metalness: number;
  normalScale: number;
  normalKey: string;
  grain: number;
  scratches?: number;
  physical?: "glass" | "ice";
}

/** Per-room material treatment. No single generic look across the ten rooms. */
export const ROOM_MATERIALS: Record<string, { wall: MaterialRecipe; floor: MaterialRecipe }> = {
  "stone-temple": {
    wall: { roughness: 0.96, metalness: 0.02, normalScale: 1.1, normalKey: "stone", grain: 40 },
    floor: { roughness: 0.88, metalness: 0.03, normalScale: 0.9, normalKey: "stone-floor", grain: 26 },
  },
  "tablet-chamber": {
    wall: { roughness: 0.94, metalness: 0.02, normalScale: 0.95, normalKey: "tablet", grain: 52 },
    floor: { roughness: 0.9, metalness: 0.02, normalScale: 0.8, normalKey: "stone-floor", grain: 26 },
  },
  "timber-cabin": {
    wall: { roughness: 0.82, metalness: 0.02, normalScale: 0.7, normalKey: "grain", grain: 120 },
    floor: { roughness: 0.76, metalness: 0.03, normalScale: 0.55, normalKey: "grain-floor", grain: 150 },
  },
  "door-chamber": {
    wall: { roughness: 0.95, metalness: 0.02, normalScale: 1, normalKey: "stone", grain: 40 },
    floor: { roughness: 0.88, metalness: 0.03, normalScale: 0.85, normalKey: "stone-floor", grain: 26 },
  },
  forge: {
    wall: { roughness: 0.72, metalness: 0.25, normalScale: 0.8, normalKey: "soot", grain: 34, scratches: 0.6 },
    floor: { roughness: 0.42, metalness: 0.82, normalScale: 0.6, normalKey: "plate", grain: 18, scratches: 0.9 },
  },
  "scroll-library": {
    wall: { roughness: 0.86, metalness: 0.02, normalScale: 0.6, normalKey: "grain", grain: 110 },
    floor: { roughness: 0.9, metalness: 0.02, normalScale: 0.7, normalKey: "stone-floor", grain: 30 },
  },
  "treasure-chamber": {
    wall: { roughness: 0.93, metalness: 0.04, normalScale: 1, normalKey: "stone", grain: 40 },
    floor: { roughness: 0.84, metalness: 0.06, normalScale: 0.85, normalKey: "stone-floor", grain: 26 },
  },
  armoury: {
    wall: { roughness: 0.9, metalness: 0.08, normalScale: 0.9, normalKey: "stone", grain: 44 },
    floor: { roughness: 0.8, metalness: 0.12, normalScale: 0.7, normalKey: "stone-floor", grain: 30 },
  },
  "glass-chamber": {
    wall: { roughness: 0.18, metalness: 0.1, normalScale: 0.35, normalKey: "glass", grain: 90 },
    floor: { roughness: 0.3, metalness: 0.2, normalScale: 0.4, normalKey: "polish", grain: 70, scratches: 0.4 },
  },
  "ice-cavern": {
    wall: { roughness: 0.22, metalness: 0.05, normalScale: 0.85, normalKey: "ice", grain: 58, scratches: 0.5 },
    floor: { roughness: 0.26, metalness: 0.04, normalScale: 0.7, normalKey: "ice-floor", grain: 46, scratches: 0.5 },
  },
};

const FALLBACK: MaterialRecipe = {
  roughness: 0.9,
  metalness: 0.03,
  normalScale: 0.8,
  normalKey: "generic",
  grain: 40,
};

export const roomMaterial = (roomId: string, part: "wall" | "floor"): MaterialRecipe =>
  ROOM_MATERIALS[roomId]?.[part] ?? FALLBACK;

/** Material treatment for the slate body itself, keyed by surface id. */
export const SURFACE_MATERIALS: Record<string, MaterialRecipe> = {
  "stone-wall": { roughness: 0.95, metalness: 0.02, normalScale: 1.2, normalKey: "slate-stone", grain: 38 },
  "stone-tablet": { roughness: 0.92, metalness: 0.02, normalScale: 1, normalKey: "slate-tablet", grain: 50 },
  wood: { roughness: 0.78, metalness: 0.02, normalScale: 0.65, normalKey: "slate-wood", grain: 130 },
  door: { roughness: 0.8, metalness: 0.06, normalScale: 0.8, normalKey: "slate-door", grain: 96 },
  "metal-plate": { roughness: 0.34, metalness: 0.88, normalScale: 0.5, normalKey: "slate-metal", grain: 20, scratches: 0.95 },
  scroll: { roughness: 0.92, metalness: 0.01, normalScale: 0.45, normalKey: "slate-scroll", grain: 160 },
  chest: { roughness: 0.66, metalness: 0.35, normalScale: 0.7, normalKey: "slate-chest", grain: 70 },
  shield: { roughness: 0.38, metalness: 0.8, normalScale: 0.6, normalKey: "slate-shield", grain: 44, scratches: 0.85 },
  glass: { roughness: 0.08, metalness: 0.05, normalScale: 0.25, normalKey: "slate-glass", grain: 100, physical: "glass" },
  ice: { roughness: 0.16, metalness: 0.03, normalScale: 0.7, normalKey: "slate-ice", grain: 56, physical: "ice", scratches: 0.6 },
};

export const surfaceMaterial = (surfaceId: string): MaterialRecipe =>
  SURFACE_MATERIALS[surfaceId] ?? FALLBACK;
