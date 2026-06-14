import algebra from "@/assets/adventure/algebra-island.png.asset.json";
import calculus from "@/assets/adventure/calculus-island.png.asset.json";
import central from "@/assets/adventure/central-dome-core.png.asset.json";
import geometry from "@/assets/adventure/geometry-island.png.asset.json";
import palace from "@/assets/adventure/mathgpl-palace.png.asset.json";
import statistics from "@/assets/adventure/statistics-island.png.asset.json";
import trig from "@/assets/adventure/trigonometry-island.png.asset.json";

export interface LibraryBackground {
  id: string;
  label: string;
  url: string;
}

export const ADVENTURE_BACKGROUND_LIBRARY: LibraryBackground[] = [
  { id: "palace", label: "MathGPL Palace", url: palace.url },
  { id: "central", label: "Central Dome", url: central.url },
  { id: "algebra", label: "Algebra Island", url: algebra.url },
  { id: "geometry", label: "Geometry Island", url: geometry.url },
  { id: "calculus", label: "Calculus Island", url: calculus.url },
  { id: "statistics", label: "Statistics Island", url: statistics.url },
  { id: "trigonometry", label: "Trigonometry Island", url: trig.url },
  { id: "staircase", label: "Staircase Entry", url: "/src/assets/adventure/staircase-entry.jpg" },
];

export function resolveBackgroundUrl(ref: { kind: "library" | "url"; ref: string } | null): string | null {
  if (!ref) return null;
  if (ref.kind === "url") return ref.ref;
  return ADVENTURE_BACKGROUND_LIBRARY.find((b) => b.id === ref.ref)?.url ?? null;
}
