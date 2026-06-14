// Curated set of effects sourced from src/assets/effects/video-fx/.
// Loaded lazily at module init via Vite glob.

const modules = import.meta.glob("/src/assets/effects/video-fx/*.asset.json", {
  eager: true,
}) as Record<string, { default: { url: string; original_filename: string } }>;

export interface EffectAsset {
  id: string;
  label: string;
  url: string;
}

export const ADVENTURE_EFFECTS: EffectAsset[] = Object.entries(modules)
  .map(([path, mod]) => {
    const file = path.split("/").pop() ?? "effect";
    const id = file.replace(/\.(mp4|mov|webm)\.asset\.json$/i, "");
    const label = id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { id, label, url: mod.default.url };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
