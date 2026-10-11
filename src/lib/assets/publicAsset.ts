/**
 * Game media that used to live in public/assets/ now lives on Lovable file
 * hosting. Old addresses (in code or saved in the database) resolve here.
 */
import map from "./publicAssetMap.json";

const MAP = map as Record<string, string>;

export function publicAsset(path: string): string {
  if (!path || !path.startsWith("/assets/")) return path;
  const clean = path.split(/[?#]/)[0];
  return MAP[clean] ?? MAP[safeDecode(clean)] ?? path;
}

function safeDecode(s: string) {
  try { return decodeURI(s); } catch { return s; }
}
