/**
 * Resolve uploaded building textures (surfaces + doors) to displayable URLs.
 * Textures are stored in the same private game-assets bucket the homepage
 * building uploads use; signed URLs are cached by the shared helper.
 */
import { getSignedUrls } from "@/lib/games/urls";
import type { EnvironmentSettings, SurfaceKey } from "./types";

export const SURFACE_KEYS: SurfaceKey[] = ["leftWall", "rightWall", "floor", "roof"];

export const SURFACE_LABEL: Record<SurfaceKey, string> = {
  leftWall: "Left wall",
  rightWall: "Right wall",
  floor: "Floor",
  roof: "Roof / ceiling",
};

/** Collect every texture storage path the environment references. */
export const collectTexturePaths = (env: EnvironmentSettings): string[] => {
  const paths: string[] = [];
  for (const key of SURFACE_KEYS) {
    if (env[key]?.texture?.path) paths.push(env[key].texture!.path);
  }
  if (env.door?.texture?.path) paths.push(env.door.texture!.path);
  return paths;
};

/**
 * Resolve all environment textures to signed URLs.
 * Returns a map keyed by "surface:path" and "door:path" so the renderer can
 * look up the exact URL for a given design without ambiguity.
 */
export const resolveEnvironmentTextures = async (
  env: EnvironmentSettings,
): Promise<Record<string, string>> => {
  const paths = collectTexturePaths(env);
  if (paths.length === 0) return {};
  const resolved = await getSignedUrls(paths);
  return resolved; // Record<path, url>
};