/**
 * Resolve uploaded building textures (surfaces + doors) to displayable URLs.
 * Textures are stored in the same private game-assets bucket the homepage
 * building uploads use; signed URLs are cached by the shared helper.
 * Built-in sample designs (`builtin:<key>`) resolve to bundled asset URLs
 * and never touch storage.
 */
import { getSignedUrls } from "@/lib/games/urls";
import { builtinTextureUrl, isBuiltinTexturePath } from "./gallery";
import type { EnvironmentSettings, SurfaceKey } from "./types";

export const SURFACE_KEYS: SurfaceKey[] = ["leftWall", "rightWall", "floor", "roof", "endWall"];

export const SURFACE_LABEL: Record<SurfaceKey, string> = {
  leftWall: "Left wall",
  rightWall: "Right wall",
  floor: "Floor",
  roof: "Ceiling",
  endWall: "End wall",
};

/** Collect every STORAGE texture path the environment references (built-ins excluded). */
export const collectTexturePaths = (env: EnvironmentSettings): string[] => {
  const paths: string[] = [];
  const note = (path: string | undefined) => {
    if (path && !isBuiltinTexturePath(path)) paths.push(path);
  };
  for (const key of SURFACE_KEYS) note(env[key]?.texture?.path);
  note(env.door?.texture?.path);
  return paths;
};

/**
 * Resolve all environment textures to URLs.
 * Returns a map keyed by "surface:path" and "door:path" so the renderer can
 * look up the exact URL for a given design without ambiguity. Built-in sample
 * paths resolve to their bundled assets; storage paths get signed URLs.
 */
export const resolveEnvironmentTextures = async (
  env: EnvironmentSettings,
): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  const note = (path: string | undefined) => {
    if (!path) return;
    if (isBuiltinTexturePath(path)) {
      const url = builtinTextureUrl(path);
      if (url) out[path] = url;
    } else {
      storagePaths.push(path);
    }
  };
  const storagePaths: string[] = [];
  for (const key of SURFACE_KEYS) note(env[key]?.texture?.path);
  note(env.door?.texture?.path);
  if (storagePaths.length > 0) {
    const resolved = await getSignedUrls(storagePaths);
    Object.assign(out, resolved);
  }
  return out;
};