// Venn Mathematical Write-up — expression generator + semantic region map.
//
// Physical regions are keyed by the sorted set ids they lie inside:
//   "A" = A only, "AB" = A∩B only (in 3-set) / A∩B (in 2-set), "ABC", "" = outside.
// Their values live in model.regions[].text (one source of truth).
// Non-physical expressions (unions, inclusive pairwise intersections in a
// 3-set diagram, U) live in model.expressions keyed by a stable id:
//   "union:AB", "inter:AB" (3-set only, includes ABC), "universe".

import type { UCEVennModel, SetId } from "./types";

export type ExprKind = "only" | "union" | "inter" | "universe";

export interface VennExpressionRow {
  /** Stable id. For kind "only" this is the physical region key. */
  id: string;
  kind: ExprKind;
  sets: SetId[];
  /** True when the value is stored on a physical region. */
  physical: boolean;
}

function combos(ids: SetId[], k: number): SetId[][] {
  const out: SetId[][] = [];
  const rec = (start: number, acc: SetId[]) => {
    if (acc.length === k) { out.push(acc); return; }
    for (let i = start; i < ids.length; i++) rec(i + 1, [...acc, ids[i]]);
  };
  rec(0, []);
  return out;
}

export function activeIds(model: Pick<UCEVennModel, "sets" | "numSets">): SetId[] {
  return model.sets.map((s) => s.id).slice(0, model.numSets).sort() as SetId[];
}

/** Ordered, duplicate-free expression list for the active sets. */
export function generateExpressions(model: Pick<UCEVennModel, "sets" | "numSets" | "universe">): VennExpressionRow[] {
  const ids = activeIds(model);
  const n = ids.length;
  const rows: VennExpressionRow[] = [];
  for (const id of ids) rows.push({ id, kind: "only", sets: [id], physical: true });
  if (n === 3) for (const c of combos(ids, 2)) rows.push({ id: c.join(""), kind: "only", sets: c, physical: true });
  for (let k = 2; k <= n; k++) for (const c of combos(ids, k)) rows.push({ id: `union:${c.join("")}`, kind: "union", sets: c, physical: false });
  for (let k = 2; k <= n; k++) for (const c of combos(ids, k)) {
    // The full intersection (A∩B in 2-set, A∩B∩C in 3-set) is a single physical region.
    if (k === n) rows.push({ id: c.join(""), kind: "inter", sets: c, physical: true });
    else rows.push({ id: `inter:${c.join("")}`, kind: "inter", sets: c, physical: false });
  }
  if (model.universe?.show) rows.push({ id: "universe", kind: "universe", sets: [], physical: false });
  return rows;
}

/** Every physical region key present for this number of sets (including outside ""). */
export function allRegionKeys(n: number): string[] {
  const ids = (["A", "B", "C"] as SetId[]).slice(0, n);
  const keys: string[] = [""];
  for (let k = 1; k <= n; k++) for (const c of combos(ids, k)) keys.push(c.join(""));
  return keys;
}

/** Physical regions an expression refers to (used for highlighting). */
export function expressionRegions(row: VennExpressionRow, n: number): string[] {
  const keys = allRegionKeys(n);
  if (row.kind === "universe") return keys;
  if (row.kind === "only") return [row.id];
  if (row.kind === "union") return keys.filter((k) => row.sets.some((s) => k.includes(s)));
  return keys.filter((k) => row.sets.every((s) => k.includes(s)));
}

export function displayLabel(row: VennExpressionRow, model: Pick<UCEVennModel, "sets">): string {
  const name = (id: SetId) => model.sets.find((s) => s.id === id)?.label?.trim() || id;
  const names = row.sets.map(name);
  switch (row.kind) {
    case "universe": return "U";
    case "only": return names.length === 1 ? `${names[0]} only` : `${names.join(" ∩ ")} only`;
    case "union": return names.join(" ∪ ");
    case "inter": return names.join(" ∩ ");
  }
}

/** Whether the layout makes this row's regions impossible (e.g. disjoint A∩B). */
export function isEmptyInLayout(row: VennExpressionRow, model: UCEVennModel): boolean {
  if (row.kind !== "inter" && !(row.kind === "only" && row.sets.length > 1)) return false;
  const rel = relationsFor(model);
  const pairs = combos(row.sets, 2);
  return pairs.some(([a, b]) => !rel[`${a}${b}` as "AB" | "AC" | "BC"]);
}

function relationsFor(model: UCEVennModel): { AB: boolean; AC: boolean; BC: boolean } {
  switch (model.layout) {
    case "twoIntersect": case "threeAll": return { AB: true, AC: true, BC: true };
    case "twoDisjoint": case "threeAllDisjoint": return { AB: false, AC: false, BC: false };
    case "threeChain": return { AB: true, AC: false, BC: true };
    case "threeOneDisjoint": return { AB: true, AC: false, BC: false };
    default: return model.relations;
  }
}

export function readValue(model: UCEVennModel, row: VennExpressionRow): string {
  if (row.physical) return model.regions.find((r) => r.key === row.id)?.text ?? "";
  return model.expressions?.[row.id] ?? "";
}

export function writeValue(model: UCEVennModel, row: VennExpressionRow, value: string): UCEVennModel {
  if (row.physical) return setRegionText(model, row.id, value);
  const expressions = { ...(model.expressions ?? {}) };
  if (value.trim() === "") delete expressions[row.id]; else expressions[row.id] = value;
  return { ...model, expressions };
}

export function setRegionText(model: UCEVennModel, key: string, value: string): UCEVennModel {
  const existing = model.regions.find((r) => r.key === key);
  const regions = existing
    ? model.regions.map((r) => (r.key === key ? { ...r, text: value } : r))
    : [...model.regions, { key, text: value, fill: "none", fillOpacity: 0.3 }];
  return { ...model, regions };
}

/**
 * Parse a semantic key used by AI directives into a row id.
 * Accepts: "A_only", "AB_only", "A∩B", "A n B", "A∪B", "A u B", "ABC", "U", "outside".
 */
export function semanticKeyToRowId(raw: string, numSets: 2 | 3): string | null {
  const k = raw.trim().replace(/\s+/g, "").toUpperCase();
  if (k === "U" || k === "UNIVERSE") return "universe";
  if (k === "OUTSIDE" || k === "NEITHER" || k === "NONE") return "";
  const only = k.match(/^([ABC]{1,3})_?ONLY$/);
  if (only) return [...only[1]].sort().join("");
  const uni = k.match(/^([ABC])(?:∪|U|UNION)([ABC])(?:(?:∪|U|UNION)([ABC]))?$/);
  if (uni) return `union:${[uni[1], uni[2], uni[3]].filter(Boolean).sort().join("")}`;
  const inter = k.match(/^([ABC])(?:∩|N|AND|INTER)([ABC])(?:(?:∩|N|AND|INTER)([ABC]))?$/);
  const idsOf = inter ? [inter[1], inter[2], inter[3]].filter(Boolean).sort().join("") : /^[ABC]{1,3}$/.test(k) ? [...k].sort().join("") : null;
  if (!idsOf) return null;
  if (inter && idsOf.length === 2 && numSets === 3) return `inter:${idsOf}`;
  return idsOf;
}
