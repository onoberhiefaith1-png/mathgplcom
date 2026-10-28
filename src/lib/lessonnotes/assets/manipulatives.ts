import type { AssetDef } from "./types";

const V = (id: string, label: string, group: string, keywords: string[]): AssetDef => ({
  id,
  label,
  category: "Manipulatives",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual: "manip", attrs: { variant: id } },
});

export const MANIPULATIVES: AssetDef[] = [
  // Probability
  V("dice", "Die (6-sided)", "Probability", ["dice", "cube"]),
  V("dice4", "Die (4-sided)", "Probability", ["dice", "tetra"]),
  V("dice8", "Die (8-sided)", "Probability", ["dice", "octa"]),
  V("dice10", "Die (10-sided)", "Probability", ["dice"]),
  V("dice12", "Die (12-sided)", "Probability", ["dice"]),
  V("dice20", "Die (20-sided)", "Probability", ["dice"]),
  V("coin", "Coin", "Probability", ["flip"]),
  V("spinner", "Spinner", "Probability", ["spin"]),
  V("playingcards", "Playing cards", "Probability", ["cards"]),
  V("urn", "Bag of marbles", "Probability", ["marbles", "bag"]),

  // Counting
  V("abacus", "Abacus", "Counting", ["counting"]),
  V("algebratiles", "Algebra tiles", "Counting", ["algebra"]),
  V("fractionstrips", "Fraction strips", "Counting", ["fraction"]),
  V("fractioncircles", "Fraction circles", "Counting", ["fraction"]),
  V("basetenblocks", "Base-ten blocks", "Counting", ["place value"]),
  V("counters", "Counters", "Counting", ["chips"]),
  V("twocolorcounters", "Two-colour counters", "Counting", ["chips", "integers"]),
  V("tenframe", "Ten frame", "Counting", ["frame"]),
];
