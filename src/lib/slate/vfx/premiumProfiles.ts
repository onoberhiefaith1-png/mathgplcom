import type { PremiumBombStyle } from "../types";

export interface PremiumBombProfile {
  id: PremiumBombStyle;
  label: string;
  colours: readonly [string, string, string, string];
  path: "direct" | "arc" | "spiral";
  shape: "sun" | "comet" | "ribbon" | "sigil" | "crystal" | "fire" | "plasma" | "star" | "spiral" | "radiant";
  cadence: number;
  trail: number;
}

export const RADIANT_CHAIN_PROFILE: PremiumBombProfile =
  { id: "radiant-chain", label: "Radiant Chain", colours: ["#ffffff", "#ffe75a", "#56eaff", "#2375ff"], path: "arc", shape: "radiant", cadence: 0.1, trail: 0.78 };

export const PREMIUM_BOMB_PROFILES: readonly PremiumBombProfile[] = [
  { id: "solar-burst", label: "Solar Burst", colours: ["#ffffff", "#fff06a", "#ffad19", "#ff5a12"], path: "direct", shape: "sun", cadence: 0.14, trail: 0.72 },
  { id: "golden-comet", label: "Golden Comet", colours: ["#ffffff", "#ffd52f", "#ff8b0b", "#ffcc66"], path: "arc", shape: "comet", cadence: 0.1, trail: 1 },
  { id: "rainbow-energy", label: "Rainbow Energy", colours: ["#79f7ff", "#318cff", "#be4dff", "#ffcf43"], path: "arc", shape: "ribbon", cadence: 0.13, trail: 0.82 },
  { id: "royal-magic", label: "Royal Magic", colours: ["#ffffff", "#246cff", "#ffd83d", "#8b35e8"], path: "arc", shape: "sigil", cadence: 0.16, trail: 0.76 },
  { id: "crystal-pulse", label: "Crystal Pulse", colours: ["#ffffff", "#69eeff", "#5e8dff", "#a74cff"], path: "direct", shape: "crystal", cadence: 0.15, trail: 0.68 },
  { id: "firestorm", label: "Firestorm", colours: ["#ffffff", "#fff044", "#ff8a08", "#f12e0b"], path: "arc", shape: "fire", cadence: 0.11, trail: 0.92 },
  { id: "plasma-burst", label: "Plasma Burst", colours: ["#ffffff", "#37eaff", "#2381ff", "#8a39ff"], path: "direct", shape: "plasma", cadence: 0.12, trail: 0.74 },
  { id: "star-explosion", label: "Star Explosion", colours: ["#ffffff", "#ffe36b", "#5eeeff", "#1356d8"], path: "direct", shape: "star", cadence: 0.08, trail: 0.62 },
  { id: "arcane-spiral", label: "Arcane Spiral", colours: ["#ffffff", "#c53cff", "#365cff", "#ffd840"], path: "spiral", shape: "spiral", cadence: 0.17, trail: 0.8 },
  RADIANT_CHAIN_PROFILE,
];

export const premiumBombProfile = (id?: PremiumBombStyle) =>
  PREMIUM_BOMB_PROFILES.find((profile) => profile.id === id) ?? RADIANT_CHAIN_PROFILE;