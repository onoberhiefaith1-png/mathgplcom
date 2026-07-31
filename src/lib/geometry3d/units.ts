// Units and precision for the teaching workspace.
//
// Units are *labels* only — the workspace works in abstract units and the
// teacher declares what one unit represents (mm, cm, m, km, in, ft).

export const UNITS = [
  { value: "none", label: "unitless", short: "" },
  { value: "mm", label: "millimetres (mm)", short: "mm" },
  { value: "cm", label: "centimetres (cm)", short: "cm" },
  { value: "m", label: "metres (m)", short: "m" },
  { value: "km", label: "kilometres (km)", short: "km" },
  { value: "in", label: "inches (in)", short: "in" },
  { value: "ft", label: "feet (ft)", short: "ft" },
] as const;

export type UnitId = (typeof UNITS)[number]["value"];

export const DECIMAL_OPTIONS = [0, 1, 2, 3, 4, 5];

const POWER_SUFFIX: Record<number, string> = { 1: "", 2: "\u00B2", 3: "\u00B3" };

/** " cm²" for unit="cm", power=2. Empty string when unitless. */
export function unitSuffix(unit: string, power = 1): string {
  const found = UNITS.find((u) => u.value === unit);
  const short = found?.short ?? "";
  if (!short) return "";
  return ` ${short}${POWER_SUFFIX[power] ?? ""}`;
}

export function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** Number formatted to the chosen precision, without a unit. */
export function formatValue(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "—";
  return roundTo(n, decimals).toFixed(decimals);
}

/** Number + unit at the given power, e.g. "12.50 cm³". */
export function formatMeasure(n: number, unit: string, decimals: number, power = 1): string {
  return `${formatValue(n, decimals)}${unitSuffix(unit, power)}`;
}
