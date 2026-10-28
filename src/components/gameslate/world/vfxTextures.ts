// Every effect texture, loaded once, before anything plays.
//
// Loading an image at the moment an effect starts suspends the whole 3D world
// (the scene blanks for a frame and comes back) which reads as stuttering.
// These are preloaded at module scope and warmed by the slate on first mount,
// so effect components always read a texture that is already resident.

import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import flareAsset from "@/assets/slate/vfx/kenney/flare-01.png.asset.json";
import sparkAsset from "@/assets/slate/vfx/kenney/spark-05.png.asset.json";
import starAsset from "@/assets/slate/vfx/kenney/star-04.png.asset.json";
import magicAsset from "@/assets/slate/vfx/kenney/magic-03.png.asset.json";
import explosionAsset from "@/assets/slate/vfx/kenney/explosion-04.png.asset.json";
import smokeAsset from "@/assets/slate/vfx/kenney/white-puff-12.png.asset.json";

export interface VfxTextures {
  flare: THREE.Texture | null;
  spark: THREE.Texture | null;
  star: THREE.Texture | null;
  magic: THREE.Texture | null;
  explosion: THREE.Texture | null;
  smoke: THREE.Texture | null;
}

export const VFX_URLS: string[] = [
  flareAsset.url,
  sparkAsset.url,
  starAsset.url,
  magicAsset.url,
  explosionAsset.url,
  smokeAsset.url,
];

useTexture.preload(VFX_URLS);

export function useVfxTextures(): VfxTextures {
  const list = useTexture(VFX_URLS);
  const [flare, spark, star, magic, explosion, smoke] = list;
  for (const texture of list) {
    if (texture && texture.colorSpace !== THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    }
  }
  return {
    flare: flare ?? null,
    spark: spark ?? null,
    star: star ?? null,
    magic: magic ?? null,
    explosion: explosion ?? null,
    smoke: smoke ?? null,
  };
}
