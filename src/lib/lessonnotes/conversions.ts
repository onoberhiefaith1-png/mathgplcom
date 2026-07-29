// Unit conversion registry for the Lesson Notes Conversion tool.
// Ratio units convert through a base unit; temperature uses offset formulas;
// currency uses editable default rates (base = GBP) so it works offline.

export type ConversionCategory =
  | "Length"
  | "Mass / Weight"
  | "Capacity"
  | "Time"
  | "Temperature"
  | "Area"
  | "Volume"
  | "Speed"
  | "Currency";

export interface UnitDef {
  id: string;
  label: string;
  symbol: string;
  /** Value of one unit expressed in the category base unit. */
  factor: number;
}

export const CATEGORIES: ConversionCategory[] = [
  "Length",
  "Mass / Weight",
  "Capacity",
  "Time",
  "Temperature",
  "Area",
  "Volume",
  "Speed",
  "Currency",
];

export const UNITS: Record<ConversionCategory, UnitDef[]> = {
  Length: [
    { id: "mm", label: "Millimetre", symbol: "mm", factor: 0.001 },
    { id: "cm", label: "Centimetre", symbol: "cm", factor: 0.01 },
    { id: "m", label: "Metre", symbol: "m", factor: 1 },
    { id: "km", label: "Kilometre", symbol: "km", factor: 1000 },
    { id: "in", label: "Inch", symbol: "in", factor: 0.0254 },
    { id: "ft", label: "Foot", symbol: "ft", factor: 0.3048 },
    { id: "yd", label: "Yard", symbol: "yd", factor: 0.9144 },
    { id: "mi", label: "Mile", symbol: "mi", factor: 1609.344 },
  ],
  "Mass / Weight": [
    { id: "mg", label: "Milligram", symbol: "mg", factor: 0.000001 },
    { id: "g", label: "Gram", symbol: "g", factor: 0.001 },
    { id: "kg", label: "Kilogram", symbol: "kg", factor: 1 },
    { id: "t", label: "Tonne", symbol: "t", factor: 1000 },
  ],
  Capacity: [
    { id: "ml", label: "Millilitre", symbol: "mL", factor: 0.001 },
    { id: "l", label: "Litre", symbol: "L", factor: 1 },
  ],
  Time: [
    { id: "s", label: "Seconds", symbol: "s", factor: 1 },
    { id: "min", label: "Minutes", symbol: "min", factor: 60 },
    { id: "h", label: "Hours", symbol: "h", factor: 3600 },
    { id: "day", label: "Days", symbol: "days", factor: 86400 },
    { id: "week", label: "Weeks", symbol: "weeks", factor: 604800 },
    { id: "month", label: "Months", symbol: "months", factor: 2629800 },
    { id: "year", label: "Years", symbol: "years", factor: 31557600 },
  ],
  Temperature: [
    { id: "c", label: "Celsius", symbol: "°C", factor: 1 },
    { id: "f", label: "Fahrenheit", symbol: "°F", factor: 1 },
    { id: "k", label: "Kelvin", symbol: "K", factor: 1 },
  ],
  Area: [
    { id: "cm2", label: "Square centimetre", symbol: "cm²", factor: 0.0001 },
    { id: "m2", label: "Square metre", symbol: "m²", factor: 1 },
    { id: "km2", label: "Square kilometre", symbol: "km²", factor: 1000000 },
    { id: "ha", label: "Hectare", symbol: "ha", factor: 10000 },
  ],
  Volume: [
    { id: "cm3", label: "Cubic centimetre", symbol: "cm³", factor: 0.000001 },
    { id: "m3", label: "Cubic metre", symbol: "m³", factor: 1 },
    { id: "l3", label: "Litre", symbol: "L", factor: 0.001 },
  ],
  Speed: [
    { id: "ms", label: "Metres per second", symbol: "m/s", factor: 1 },
    { id: "kmh", label: "Kilometres per hour", symbol: "km/h", factor: 1 / 3.6 },
    { id: "mph", label: "Miles per hour", symbol: "mph", factor: 0.44704 },
  ],
  Currency: [
    { id: "gbp", label: "British Pound", symbol: "£", factor: 1 },
    { id: "usd", label: "US Dollar", symbol: "$", factor: 1 },
    { id: "eur", label: "Euro", symbol: "€", factor: 1 },
    { id: "ngn", label: "Nigerian Naira", symbol: "₦", factor: 1 },
  ],
};

/** Default currency rates: how many units of the currency equal 1 GBP. */
export const DEFAULT_CURRENCY_RATES: Record<string, number> = {
  gbp: 1,
  usd: 1.27,
  eur: 1.17,
  ngn: 1950,
};

const RATES_KEY = "lesson-conversion-currency-rates";

export function loadCurrencyRates(): Record<string, number> {
  if (typeof window === "undefined") return { ...DEFAULT_CURRENCY_RATES };
  try {
    const raw = window.localStorage.getItem(RATES_KEY);
    if (!raw) return { ...DEFAULT_CURRENCY_RATES };
    return { ...DEFAULT_CURRENCY_RATES, ...(JSON.parse(raw) as Record<string, number>) };
  } catch {
    return { ...DEFAULT_CURRENCY_RATES };
  }
}

export function saveCurrencyRates(rates: Record<string, number>) {
  try { window.localStorage.setItem(RATES_KEY, JSON.stringify(rates)); } catch { /* noop */ }
}

export function findUnit(category: ConversionCategory, id: string): UnitDef | undefined {
  return UNITS[category].find((u) => u.id === id);
}

function toCelsius(value: number, id: string): number {
  if (id === "f") return (value - 32) * (5 / 9);
  if (id === "k") return value - 273.15;
  return value;
}

function fromCelsius(value: number, id: string): number {
  if (id === "f") return value * (9 / 5) + 32;
  if (id === "k") return value + 273.15;
  return value;
}

export function convert(
  value: number,
  category: ConversionCategory,
  fromId: string,
  toId: string,
  currencyRates: Record<string, number> = DEFAULT_CURRENCY_RATES,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (category === "Temperature") return fromCelsius(toCelsius(value, fromId), toId);
  if (category === "Currency") {
    const from = currencyRates[fromId];
    const to = currencyRates[toId];
    if (!from || !to) return null;
    return (value / from) * to;
  }
  const a = findUnit(category, fromId);
  const b = findUnit(category, toId);
  if (!a || !b) return null;
  return (value * a.factor) / b.factor;
}

/** Classroom-friendly formatting: trims noise without losing small values. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.0001 || abs >= 1e9)) return value.toExponential(4);
  const rounded = Number(value.toFixed(6));
  return String(rounded);
}
