// Signed-URL cache for private game-assets storage objects.
import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET } from "./types";

interface CacheEntry {
  url: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const SIGN_TTL = 60 * 60;

export const getCachedSignedUrl = (path?: string | null): string | null => {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  return null;
};

export const getSignedUrl = async (path: string): Promise<string | null> => {
  if (!path) return null;
  const hit = cache.get(path);
  const now = Date.now();
  if (hit && hit.expires > now + 60_000) return hit.url;

  const { data, error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .createSignedUrl(path, SIGN_TTL);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, expires: now + SIGN_TTL * 1000 });
  return data.signedUrl;
};

export const getSignedUrls = async (
  paths: string[],
): Promise<Record<string, string>> => {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (p) => {
      const url = await getSignedUrl(p);
      if (url) out[p] = url;
    }),
  );
  return out;
};
