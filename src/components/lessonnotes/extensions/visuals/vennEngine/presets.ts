// Preset builder — every Venn tile seeds one UCEVennModel.

import { DEFAULT_UNIVERSE, defaultSet, type SetLayout, type UCEVennModel, type VennSet } from "./types";

const W = 260, H = 180;

export function buildVennPreset(id: string): UCEVennModel {
  const preset = (id || "venn2").toLowerCase();

  const colours = { A: "#3b82f6", B: "#ef4444", C: "#22c55e" } as const;
  const twoSets = (): VennSet[] => [
    defaultSet("A", W / 2 - 40, H / 2, colours.A),
    defaultSet("B", W / 2 + 40, H / 2, colours.B),
  ];
  const threeSets = (): VennSet[] => [
    defaultSet("A", W / 2 - 40, H / 2 + 20, colours.A),
    defaultSet("B", W / 2 + 40, H / 2 + 20, colours.B),
    defaultSet("C", W / 2, H / 2 - 30, colours.C),
  ];

  const base = { presetId: preset, width: W, height: H, regions: [], universe: { ...DEFAULT_UNIVERSE } };

  switch (preset) {
    case "venn2":
      return { ...base, layout: "twoIntersect", numSets: 2, relations: { AB: true, AC: false, BC: false }, sets: twoSets() };
    case "venndisjoint":
      return { ...base, layout: "twoDisjoint", numSets: 2, relations: { AB: false, AC: false, BC: false }, sets: twoSets() };
    case "venn3":
      return { ...base, layout: "threeAll", numSets: 3, relations: { AB: true, AC: true, BC: true }, sets: threeSets() };
    default:
      return { ...base, layout: "twoIntersect" as SetLayout, numSets: 2, relations: { AB: true, AC: false, BC: false }, sets: twoSets() };
  }
}
