import type { AssetDef } from "./types";

const V = (id: string, label: string, group: string, keywords: string[]): AssetDef => ({
  id,
  label,
  category: "Measurement",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual: "tool", attrs: { variant: id } },
});

export const MEASUREMENT: AssetDef[] = [
  // Measurement Tools
  V("ruler", "Ruler", "Measurement Tools", ["length"]),
  V("protractor", "Protractor", "Measurement Tools", ["angle"]),
  V("compass", "Compass", "Measurement Tools", ["circle"]),
  V("setsquare45", "Set square (45°)", "Measurement Tools", ["drafting"]),
  V("setsquare3060", "Set square (30°/60°)", "Measurement Tools", ["drafting"]),
  V("thermometer", "Thermometer", "Measurement Tools", ["temp"]),
  V("measuringcylinder", "Measuring cylinder", "Measurement Tools", ["volume"]),
  V("weighingscale", "Weighing scale", "Measurement Tools", ["mass"]),
  V("balancescale", "Balance scale", "Measurement Tools", ["mass", "equation"]),
  V("dialscale", "Dial scale", "Measurement Tools", ["mass"]),
  V("tapemeasure", "Tape measure", "Measurement Tools", ["length"]),

  // Time
  V("clock", "Clock (analog)", "Time", ["time"]),
  V("clockDigital", "Clock (digital)", "Time", ["time"]),
  V("calendar", "Calendar", "Time", ["time", "month"]),
  V("stopwatch", "Stopwatch", "Time", ["time"]),
];
