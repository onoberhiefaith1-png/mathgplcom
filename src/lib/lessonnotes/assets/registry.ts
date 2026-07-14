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

export const ALL_ASSETS: AssetDef[] = [
  ...STRUCTURES, ...SYMBOLS, ...DIAGRAMS, ...GRAPHS,
  ...TABLES, ...MANIPULATIVES, ...MEASUREMENT, ...REALWORLD,
];

/** Lightweight fuzzy scorer: prefix beats subsequence beats miss. */
function score(a: AssetDef, q: string): number {
  if (!q) return 1;
  const query = q.toLowerCase();
  const tokens = [a.id.toLowerCase(), a.label.toLowerCase(), ...a.keywords.map((k) => k.toLowerCase())];
  let best = 0;
  for (const t of tokens) {
    if (t === query) return 1000;
    if (t.startsWith(query)) best = Math.max(best, 500 - (t.length - query.length));
    else if (t.includes(query)) best = Math.max(best, 250 - (t.length - query.length));
    else {
      // subsequence
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
    .sort((x, y) => y.s - x.s || x.a.label.localeCompare(y.a.label));
  return scored.slice(0, limit).map((x) => x.a);
}

export type { AssetDef, AssetCategory, AssetRender } from "./types";
