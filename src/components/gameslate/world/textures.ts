import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { ROOMS } from "@/lib/slate/rooms";
import { SURFACES } from "@/lib/slate/surfaces";

/** Every material image the world can need, loaded once so room swaps never re-suspend. */
export const TEXTURE_URLS: string[] = Array.from(
  new Set([
    ...SURFACES.map((surface) => surface.texture),
    ...ROOMS.flatMap((room) => [room.wallTexture, room.floorTexture]),
  ]),
);

export function useTextureMap(): Record<string, THREE.Texture> {
  const loaded = useLoader(THREE.TextureLoader, TEXTURE_URLS);
  return useMemo(() => {
    const map: Record<string, THREE.Texture> = {};
    TEXTURE_URLS.forEach((url, index) => {
      const texture = loaded[index];
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        map[url] = texture;
      }
    });
    return map;
  }, [loaded]);
}

const tiledCache = new Map<string, THREE.Texture>();

export function tiled(texture: THREE.Texture | undefined, x: number, y: number): THREE.Texture | null {
  if (!texture) return null;
  const key = `${texture.uuid}:${x}:${y}`;
  const cached = tiledCache.get(key);
  if (cached) return cached;
  const clone = texture.clone();
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(x, y);
  clone.colorSpace = THREE.SRGBColorSpace;
  clone.needsUpdate = true;
  tiledCache.set(key, clone);
  return clone;
}
