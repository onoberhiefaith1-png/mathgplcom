import algebra from "@/assets/adventure/algebra-island.png.asset.json";
import calculus from "@/assets/adventure/calculus-island.png.asset.json";
import central from "@/assets/adventure/central-dome-core.png.asset.json";
import academyBannerHall from "@/assets/adventure/custom-backgrounds/mathgpl-academy-banner-hall.png.asset.json";
import academyGate from "@/assets/adventure/custom-backgrounds/mathgpl-academy-gate.png.asset.json";
import academyGrandStaircase from "@/assets/adventure/custom-backgrounds/mathgpl-academy-grand-staircase.png.asset.json";
import bloomCourtyard from "@/assets/adventure/custom-backgrounds/mathgpl-bloom-courtyard.png.asset.json";
import celestialObservatory from "@/assets/adventure/custom-backgrounds/mathgpl-celestial-observatory.png.asset.json";
import crystalRotunda from "@/assets/adventure/custom-backgrounds/mathgpl-crystal-rotunda.png.asset.json";
import eternalLibrary from "@/assets/adventure/custom-backgrounds/mathgpl-eternal-library.png.asset.json";
import geometrySanctum from "@/assets/adventure/custom-backgrounds/mathgpl-geometry-sanctum.png.asset.json";
import grandHall from "@/assets/adventure/custom-backgrounds/mathgpl-grand-hall.png.asset.json";
import infinityRotunda from "@/assets/adventure/custom-backgrounds/mathgpl-infinity-rotunda.png.asset.json";
import observatoryHall from "@/assets/adventure/custom-backgrounds/mathgpl-observatory-hall.png.asset.json";
import royalStairHall from "@/assets/adventure/custom-backgrounds/mathgpl-royal-stair-hall.png.asset.json";
import staircaseWingClose from "@/assets/adventure/custom-backgrounds/mathgpl-staircase-wing-close.png.asset.json";
import staircaseWingWide from "@/assets/adventure/custom-backgrounds/mathgpl-staircase-wing-wide.png.asset.json";
import statueStairHall from "@/assets/adventure/custom-backgrounds/mathgpl-statue-stair-hall.png.asset.json";
import strategyChamber from "@/assets/adventure/custom-backgrounds/mathgpl-strategy-chamber.png.asset.json";
import sunriseStairHall from "@/assets/adventure/custom-backgrounds/mathgpl-sunrise-stair-hall.png.asset.json";
import wisteriaCourtyard from "@/assets/adventure/custom-backgrounds/mathgpl-wisteria-courtyard.png.asset.json";
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
  { id: "academy-banner-hall", label: "Academy Banner Hall", url: academyBannerHall.url },
  { id: "academy-gate", label: "Academy Gate", url: academyGate.url },
  { id: "academy-grand-staircase", label: "Academy Grand Staircase", url: academyGrandStaircase.url },
  { id: "bloom-courtyard", label: "Bloom Courtyard", url: bloomCourtyard.url },
  { id: "celestial-observatory", label: "Celestial Observatory", url: celestialObservatory.url },
  { id: "crystal-rotunda", label: "Crystal Rotunda", url: crystalRotunda.url },
  { id: "eternal-library", label: "Eternal Library", url: eternalLibrary.url },
  { id: "geometry-sanctum", label: "Geometry Sanctum", url: geometrySanctum.url },
  { id: "grand-hall", label: "Grand Hall", url: grandHall.url },
  { id: "infinity-rotunda", label: "Infinity Rotunda", url: infinityRotunda.url },
  { id: "observatory-hall", label: "Observatory Hall", url: observatoryHall.url },
  { id: "royal-stair-hall", label: "Royal Stair Hall", url: royalStairHall.url },
  { id: "staircase-wing-wide", label: "Staircase Wing", url: staircaseWingWide.url },
  { id: "staircase-wing-close", label: "Staircase Wing Close", url: staircaseWingClose.url },
  { id: "statue-stair-hall", label: "Statue Stair Hall", url: statueStairHall.url },
  { id: "strategy-chamber", label: "Strategy Chamber", url: strategyChamber.url },
  { id: "sunrise-stair-hall", label: "Sunrise Stair Hall", url: sunriseStairHall.url },
  { id: "wisteria-courtyard", label: "Wisteria Courtyard", url: wisteriaCourtyard.url },
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
