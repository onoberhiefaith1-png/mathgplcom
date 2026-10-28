// Turns a scanned material family into ready three.js maps with correct
// colour-space handling: base colour is sRGB, every other map is raw data.

import { useMemo } from "react";
import * as THREE from "three";
import { PBR_SETS, type PbrFamily } from "@/lib/slate/pbr";
import { useAsyncTextures } from "./loadTexture";

const cache = new Map<string, THREE.Texture>();
const MAX_PREPARED_TEXTURES = 256;

/**
 * Stand-in map used only while a scanned image is still arriving. It keeps the
 * surface lit and writable; the real map replaces it without any visual jump.
 */
const flats = new Map<string, THREE.Texture>();
const flatTexture = (colour: string, srgb: boolean): THREE.Texture => {
  const id = `${colour}:${srgb}`;
  const hit = flats.get(id);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  flats.set(id, texture);
  return texture;
};


const stableRepeat = (value: number) => Math.round(Math.max(0.25, value) * 4) / 4;

function prepare(
  texture: THREE.Texture,
  key: string,
  colour: boolean,
  rx: number,
  ry: number,
  offset: number,
): THREE.Texture {
  const repeatX = stableRepeat(rx);
  const repeatY = stableRepeat(ry);
  const id = `${key}:${repeatX}:${repeatY}:${offset}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const clone = texture.clone();
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(repeatX, repeatY);
  clone.offset.set(offset, offset * 0.37);
  clone.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  clone.anisotropy = 8;
  // scanned AO maps here share the single UV set of the geometry
  clone.channel = 0;
  clone.needsUpdate = true;
  cache.set(id, clone);
  // Keep repeat variants bounded across repeated Game visits. The generous cap
  // avoids evicting the small active set while preventing session-long growth.
  if (cache.size > MAX_PREPARED_TEXTURES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest && oldest !== id) cache.delete(oldest);
  }
  return clone;
}

export interface PbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
  normalScale: THREE.Vector2;
  roughness: number;
  metalness: number;
  color: string;
}

/**
 * Loads (and caches) one scanned family at a given tiling. `offset` shifts the
 * maps so two surfaces sharing a family never line up into a visible repeat.
 */
export function usePbr(
  family: PbrFamily,
  rx: number,
  ry: number,
  offset = 0,
): PbrMaps {
  const definition = PBR_SETS[family];
  // Loading happens beside the render, never in front of it: the writing
  // surfaces appear straight away and each scanned map attaches on arrival.
  const [map, normalMap, roughnessMap, aoMap] = useAsyncTextures([
    definition.map,
    definition.normalMap,
    definition.roughnessMap,
    definition.aoMap,
  ]);

  return useMemo(() => {
    const key = family;
    return {
      map: map ? prepare(map, `${key}:c`, true, rx, ry, offset) : flatTexture("#cfc6b4", true),
      normalMap: normalMap
        ? prepare(normalMap, `${key}:n`, false, rx, ry, offset)
        : flatTexture("#8080ff", false),
      roughnessMap: roughnessMap
        ? prepare(roughnessMap, `${key}:r`, false, rx, ry, offset)
        : flatTexture("#ffffff", false),
      aoMap: aoMap ? prepare(aoMap, `${key}:a`, false, rx, ry, offset) : flatTexture("#ffffff", false),
      normalScale: new THREE.Vector2(definition.normalScale, definition.normalScale),
      roughness: definition.roughness,
      metalness: definition.metalness,
      color: definition.tint,
    };
  }, [family, map, normalMap, roughnessMap, aoMap, rx, ry, offset, definition]);
}

