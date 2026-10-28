// Effect assets are prepared per effect, once, off the interaction path.
//
// Selecting an effect must never wait for anything: the selection is applied
// straight away and preparation runs behind it. Every effect keeps its own
// cached readiness promise, so choosing the same effect again is instant.

import * as THREE from "three";
import { setPerf } from "./perf";
import flareAsset from "@/assets/slate/vfx/kenney/flare-01.png.asset.json";
import sparkAsset from "@/assets/slate/vfx/kenney/spark-05.png.asset.json";
import starAsset from "@/assets/slate/vfx/kenney/star-04.png.asset.json";
import magicAsset from "@/assets/slate/vfx/kenney/magic-03.png.asset.json";
import explosionAsset from "@/assets/slate/vfx/kenney/explosion-04.png.asset.json";
import smokeAsset from "@/assets/slate/vfx/kenney/white-puff-12.png.asset.json";

const SHARED = [flareAsset.url, explosionAsset.url, smokeAsset.url];

/** Which images each effect family actually needs. */
const ASSETS: Record<string, string[]> = {
  "chain-bomb": [...SHARED, sparkAsset.url, starAsset.url, magicAsset.url],
  core: [...SHARED, sparkAsset.url],
  seal: [...SHARED, starAsset.url],
  heart: [...SHARED, sparkAsset.url],
  shard: [...SHARED, starAsset.url],
  "sweep-horizontal": [...SHARED, sparkAsset.url],
  "sweep-vertical": [...SHARED, sparkAsset.url],
};

const loader = new THREE.TextureLoader();
const textures = new Map<string, Promise<THREE.Texture>>();
const ready = new Map<string, Promise<void>>();

function loadOnce(url: string) {
  let pending = textures.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
    textures.set(url, pending);
  }
  return pending;
}

/** True when this effect's assets are already decoded and cached. */
export function effectReady(effectId: string) {
  return ready.has(effectId);
}

/**
 * Prepare one effect. Resolves immediately on later calls, so repeated
 * selection and repeated playback cost nothing.
 */
export function ensureEffectReady(effectId: string, label = effectId): Promise<void> {
  const existing = ready.get(effectId);
  if (existing) return existing;
  const started = performance.now();
  const urls = ASSETS[effectId] ?? SHARED;
  const pending = Promise.all(urls.map(loadOnce))
    .then(() => {
      setPerf({ readyMs: Math.round(performance.now() - started), readyLabel: label });
    })
    .catch(() => {
      // a missing image must never block the interface
      setPerf({ readyMs: Math.round(performance.now() - started), readyLabel: `${label} (partial)` });
    });
  ready.set(effectId, pending);
  return pending;
}
