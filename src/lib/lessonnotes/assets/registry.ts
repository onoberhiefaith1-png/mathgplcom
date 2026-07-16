// Aggregated asset registry + fuzzy search. Adding a new asset =
// append to one of the category files and re-export here. No editor
// changes required.

import type { AssetDef } from "./types";
import { SYMBOLS } from "./symbols";
import { STRUCTURES } from "./structures";
import { DIAGRAMS } from "./diagrams";
import { GRAPHS } from "./graphs";
import { TABLES } from "./tables";
import { MANIPULATIVES } from "./manipulatives";
import { MEASUREMENT } from "./measurement";
import { REALWORLD } from "./realworld";
import {
  getEffectiveLabel,
  getEffectiveShortCode,
  normaliseShortCode,
} from "./overrides";

// ─── Curated default Short Codes ──────────────────────────────────────
// Authoritative list from the design spec. Anything not listed gets an
// auto-derived unique code (see assignDefaultShortCodes below).
const CURATED: Record<string, string> = {
  // structures
  fraction: "FR",
  sqrt: "SQ",
  nthroot: "SQN",
  power: "POW",
  subscript: "SUB",
  // tables
  table: "TB",
  // diagrams — geometric shapes
  triangle: "TRI",
  rectangle: "REC",
  square: "SQR",
  circle: "CIR",
  parallelogram: "PAR",
  trapezium: "TRAP",
  rhombus: "RHOM",
  polygon: "POLY",
  hexagon: "HEX",
  pentagon: "PEN",
  // charts
  barchart: "BAR",
  histogram: "HIST",
  piechart: "PIE",
  linechart: "LINE",
  scatter: "SCAT",
  // graph
  coordinategraph: "GRAPH",
  numberline: "NL",
  // measurement / manipulatives
  compass: "COMP",
  protractor: "PRO",
  ruler: "RULE",
  // sets
  vennDiagram: "VENN",
};

function fallbackCode(a: AssetDef): string {
  // Prefer initials of the label, else uppercased id.
  const words = a.label.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/);
  let base = words.length > 1
    ? words.map((w) => w[0]).join("")
    : (words[0] ?? a.id);
  base = normaliseShortCode(base) || normaliseShortCode(a.id) || "X";
  if (base.length < 2) base = normaliseShortCode(a.id).slice(0, 3) || base;
  return base.slice(0, 6);
}

function assignDefaultShortCodes(defs: AssetDef[]) {
  const used = new Set<string>();
  // First pass: honour explicit shortCode from the asset definition and
  // the CURATED table.
  for (const a of defs) {
    let code = normaliseShortCode(a.shortCode ?? CURATED[a.id] ?? "");
    if (code && !used.has(code)) {
      a.shortCode = code;
      used.add(code);
    }
  }
  // Second pass: fill in the rest with auto-derived codes, disambiguated
  // with a numeric suffix if needed.
  for (const a of defs) {
    if (a.shortCode) continue;
    const base = fallbackCode(a);
    let code = base;
    let n = 2;
    while (used.has(code)) { code = `${base}${n++}`.slice(0, 8); }
    a.shortCode = code;
    used.add(code);
  }
}

export const ALL_ASSETS: AssetDef[] = [
  ...STRUCTURES, ...SYMBOLS, ...DIAGRAMS, ...GRAPHS,
  ...TABLES, ...MANIPULATIVES, ...MEASUREMENT, ...REALWORLD,
];

assignDefaultShortCodes(ALL_ASSETS);

/** Lightweight fuzzy scorer: prefix beats subsequence beats miss. */
function score(a: AssetDef, q: string): number {
  if (!q) return 1;
  const query = q.toLowerCase();
  const code = (getEffectiveShortCode(a) || "").toLowerCase();
  // Short-code exact / prefix match ranks highest.
  if (code && code === query) return 10000;
  if (code && code.startsWith(query)) return 2000 - (code.length - query.length);
  const label = getEffectiveLabel(a).toLowerCase();
  const tokens = [a.id.toLowerCase(), label, ...a.keywords.map((k) => k.toLowerCase())];
  let best = 0;
  for (const t of tokens) {
    if (t === query) return 1000;
    if (t.startsWith(query)) best = Math.max(best, 500 - (t.length - query.length));
    else if (t.includes(query)) best = Math.max(best, 250 - (t.length - query.length));
    else {
      let i = 0;
      for (const ch of t) { if (ch === query[i]) i++; if (i === query.length) break; }
      if (i === query.length) best = Math.max(best, 50);
    }
  }
  return best;
}

export function searchAssets(query: string, limit = 40): AssetDef[] {
  const scored = ALL_ASSETS.map((a) => ({ a, s: score(a, query) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || getEffectiveLabel(x.a).localeCompare(getEffectiveLabel(y.a)));
  return scored.slice(0, limit).map((x) => x.a);
}

/**
 * Resolve an asset whose *effective* Short Code exactly matches the given
 * query (case-insensitive). Used by @-command Enter-key insert.
 */
export function resolveByShortCode(query: string): AssetDef | null {
  const code = normaliseShortCode(query);
  if (!code) return null;
  for (const a of ALL_ASSETS) {
    if (getEffectiveShortCode(a) === code) return a;
  }
  return null;
}

export type { AssetDef, AssetCategory, AssetRender } from "./types";
export { getEffectiveLabel, getEffectiveShortCode } from "./overrides";
