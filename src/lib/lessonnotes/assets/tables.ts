import type { AssetDef } from "./types";

const V = (
  id: string,
  label: string,
  group: string,
  keywords: string[],
  attrs: Record<string, unknown>,
): AssetDef => ({
  id,
  label,
  category: "Tables",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual: "table", attrs: { variant: id, ...attrs } },
});

// Register a bespoke arithmetic structure. Each renders its own smart
// component (place-value chart, long division, division ladder, …).
const A = (
  id: string,
  label: string,
  visual: string,
  keywords: string[],
  attrs: Record<string, unknown> = {},
  hint?: string,
): AssetDef => ({
  id,
  label,
  category: "Tables",
  group: "Arithmetic",
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual, attrs },
  hint,
});

export const TABLES: AssetDef[] = [
  // ── Statistical ────────────────────────────────────────────────────────
  // ONE Smart Table becomes any statistical table (frequency, mean,
  // variance, two-way, probability, truth, function, tally, stem-and-leaf,
  // grouped, fraction/decimal/%, …). Anything the Smart Table can build,
  // we do NOT ship as its own asset.
  {
    id: "smarttable",
    label: "Smart table",
    category: "Tables",
    group: "Statistical",
    keywords: [
      "smart", "table", "statistical", "statistics", "frequency", "mean",
      "variance", "standard deviation", "probability", "data", "two-way",
      "grouped", "tally", "stem", "leaf", "truth", "function", "fdp",
      "fraction", "decimal", "percentage",
    ],
    render: { kind: "visual", visual: "smarttable", attrs: { rows: 3, cols: 3 } },
    hint: "editable",
  },

  // ── Arithmetic ────────────────────────────────────────────────────────
  // Only structures the Smart Table CANNOT recreate.
  A("placeValueChart", "Place-value chart", "placeValueChart",
    ["digits", "place", "value", "HTh", "TTh", "Th", "H", "T", "U", "decimal"],
    {}, "editable"),
  A("longDivision", "Long division", "longDivision",
    ["divide", "bus stop", "quotient", "dividend"],
    {}, "editable"),
  A("divisionLadder", "Division ladder (HCF / LCM)", "divisionLadder",
    ["hcf", "lcm", "prime", "factor", "ladder", "cake"],
    {}, "editable"),
  A("baseConversion", "Number-base conversion", "baseConversion",
    ["binary", "octal", "hex", "hexadecimal", "base", "remainder"],
    {}, "editable"),
  A("fractionWall", "Fraction wall", "fractionWall",
    ["fraction", "wall", "partition", "equivalent"],
    {}, "editable"),
  A("fractionStrip", "Fraction strip", "fractionStrip",
    ["fraction", "strip", "bar", "partition"],
    {}, "editable"),
  A("base10Blocks", "Base-10 blocks", "base10Blocks",
    ["dienes", "manipulative", "unit", "rod", "flat", "cube", "place value"],
    {}, "manipulative"),
  A("abacusManipulative", "Abacus", "abacusManipulative",
    ["abacus", "beads", "manipulative", "place value"],
    {}, "manipulative"),
];
