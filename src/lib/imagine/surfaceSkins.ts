/** Maps every Game surface id to one static, CSS-only Imagine skin. */
export type ImagineSkin =
  | "scroll" | "cloud" | "wood" | "stone" | "metal" | "glass" | "royal"
  | "leaf" | "aura" | "ribbon" | "chest" | "shield" | "plain";

const MAP: Record<string, ImagineSkin> = {
  scroll: "scroll", "parchment-scroll": "scroll",
  cloud: "cloud", "cloud-panel": "cloud",
  wood: "wood", door: "wood", "wooden-sign": "wood",
  "stone-wall": "stone", "stone-tablet": "stone",
  "metal-plate": "metal",
  glass: "glass", ice: "glass", "crystal-glass": "glass",
  "royal-paper": "royal", "royal-plaque": "royal",
  "leaf-frame": "leaf", "magical-aura": "aura", "silk-ribbon": "ribbon",
  chest: "chest", shield: "shield",
};

export function surfaceSkin(id: string): ImagineSkin {
  return MAP[id.replace(/^new-/, "")] ?? "plain";
}

/**
 * Faithful pictures of each Game surface (captured once from the Game's own
 * 3D surface), shown as a 9-slice frame so edges keep their shape as the
 * surface grows. Static images only: Imagine never loads 3D.
 */
const PICTURES = import.meta.glob<{ url: string }>("@/assets/imagine/surfaces/*.webp.asset.json", {
  eager: true,
  import: "default",
});

export function surfacePicture(id: string): string | null {
  for (const [path, asset] of Object.entries(PICTURES)) {
    if (path.endsWith(`/${id}.webp.asset.json`)) return asset.url;
  }
  return null;
}

/** Fixed edge slices (percent of the picture) and their on-screen widths (px). */
export function surfaceSlice(id: string): { slice: string; width: string } {
  const base = id.replace(/^new-/, "");
  if (base === "scroll" || base === "parchment-scroll" || base === "silk-ribbon")
    return { slice: "30% 12% fill", width: "26px 40px" };
  if (base === "royal-plaque" || base === "royal-paper")
    return { slice: "32% 10% fill", width: "30px 36px" };
  if (base === "cloud" || base === "cloud-panel" || base === "leaf-frame")
    return { slice: "30% 14% fill", width: "24px 36px" };
  return { slice: "22% 8% fill", width: "16px 22px" };
}
