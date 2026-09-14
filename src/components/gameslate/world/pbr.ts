// Turns a scanned material family into ready three.js maps with correct
// colour-space handling: base colour is sRGB, every other map is raw data.

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PBR_SETS, type PbrFamily } from "@/lib/slate/pbr";

const cache = new Map<string, THREE.Texture>();

function prepare(
  texture: THREE.Texture,
  key: string,
  colour: boolean,
  rx: number,
  ry: number,
  offset: number,
): THREE.Texture {
  const id = `${key}:${rx}:${ry}:${offset}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const clone = texture.clone();
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(rx, ry);
  clone.offset.set(offset, offset * 0.37);
  clone.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  clone.anisotropy = 8;
  // scanned AO maps here share the single UV set of the geometry
  clone.channel = 0;
  clone.needsUpdate = true;
  cache.set(id, clone);
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
  const [map, normalMap, roughnessMap, aoMap] = useTexture([
    definition.map,
    definition.normalMap,
    definition.roughnessMap,
    definition.aoMap,
  ]) as THREE.Texture[];

  return useMemo(() => {
    const key = family;
    return {
      map: prepare(map!, `${key}:c`, true, rx, ry, offset),
      normalMap: prepare(normalMap!, `${key}:n`, false, rx, ry, offset),
      roughnessMap: prepare(roughnessMap!, `${key}:r`, false, rx, ry, offset),
      aoMap: prepare(aoMap!, `${key}:a`, false, rx, ry, offset),
      normalScale: new THREE.Vector2(definition.normalScale, definition.normalScale),
      roughness: definition.roughness,
      metalness: definition.metalness,
      color: definition.tint,
    };
  }, [family, map, normalMap, roughnessMap, aoMap, rx, ry, offset, definition]);
}
