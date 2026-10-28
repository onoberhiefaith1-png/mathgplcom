// Readable placement for Venn write-up values.
// - Region values: pole-of-inaccessibility search (point furthest from any
//   circle edge inside the region). If the text does not fit, it becomes a
//   callout in the notes band with a leader line.
// - Non-physical expressions (unions, inclusive intersections, U) always go
//   to the notes band as "label = value".
// - requiredSize grows the diagram so nothing is clipped or shrunk.

import type { UCEVennModel, VennSet } from "./types";
import { displayLabel, generateExpressions, readValue } from "./expressions";

export const VALUE_FONT = 13;
export const NOTE_FONT = 12;
const LINE_H = 18;

export function textWidth(s: string, font: number): number {
  // Deterministic estimate (no DOM) — works in SSR and tests.
  let w = 0;
  for (const ch of s) w += /[MW∩∪]/.test(ch) ? 0.85 : /[il.,:;|' ]/.test(ch) ? 0.32 : /[A-Z0-9]/.test(ch) ? 0.66 : 0.56;
  return w * font;
}

function inRegion(x: number, y: number, key: string, sets: VennSet[]): boolean {
  for (const s of sets) {
    const inside = (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.radius * s.radius;
    if (key.includes(s.id) !== inside) return false;
  }
  return true;
}

/** Distance from (x,y) to the nearest circle edge. */
function clearance(x: number, y: number, sets: VennSet[]): number {
  let d = Infinity;
  for (const s of sets) d = Math.min(d, Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.radius));
  return d;
}

export function regionPole(key: string, sets: VennSet[], box?: { w: number; h: number }): { x: number; y: number; clear: number } | null {
  if (!key) return null;
  const inside = sets.filter((s) => key.includes(s.id));
  if (!inside.length) return null;
  const minX = Math.max(...inside.map((s) => s.cx - s.radius));
  const maxX = Math.min(...inside.map((s) => s.cx + s.radius));
  const minY = Math.max(...inside.map((s) => s.cy - s.radius));
  const maxY = Math.min(...inside.map((s) => s.cy + s.radius));
  let best: { x: number; y: number; clear: number } | null = null;
  const step = 3;
  for (let x = minX; x <= maxX; x += step) for (let y = minY; y <= maxY; y += step) {
    if (!inRegion(x, y, key, sets)) continue;
    let c = clearance(x, y, sets);
    if (box) {
      // Require the whole text box to stay inside the region.
      const hw = box.w / 2, hh = box.h / 2;
      const ok = [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]].every(([px, py]) => inRegion(px, py, key, sets));
      if (!ok) c = c * 0.2;
    }
    if (!best || c > best.clear) best = { x, y, clear: c };
  }
  return best;
}

export interface PlacedValue { key: string; text: string; x: number; y: number; callout?: { fromX: number; fromY: number } }
export interface NoteLine { id: string; text: string; highlightKey: string }
export interface VennLayoutResult {
  values: PlacedValue[];
  notes: NoteLine[];
  width: number;
  height: number;
  notesTop: number;
  outside?: { text: string; x: number; y: number };
  universe?: { text: string; x: number; y: number };
}

export function layoutWriteUp(model: UCEVennModel, sets: VennSet[]): VennLayoutResult {
  const visible = sets.filter((s) => s.visible);
  const values: PlacedValue[] = [];
  const notes: NoteLine[] = [];
  const names = (key: string) => key.split("").map((id) => visible.find((s) => s.id === id)?.label || id).join(" ∩ ");

  for (const r of model.regions) {
    const text = (r.text ?? "").trim();
    if (!text || r.key === "") continue;
    const w = textWidth(text, VALUE_FONT) + 6;
    const pole = regionPole(r.key, visible, { w, h: VALUE_FONT + 4 });
    if (!pole) continue;
    const fits = pole.clear * 2 >= Math.min(w, 40) && w <= pole.clear * 2 + 26;
    if (fits) values.push({ key: r.key, text, x: pole.x, y: pole.y });
    else {
      notes.push({ id: r.key, text: `${r.key.length === 1 ? `${names(r.key)} only` : names(r.key)} = ${text}`, highlightKey: r.key });
      values.push({ key: r.key, text: `(${notes.length})`, x: pole.x, y: pole.y });
      notes[notes.length - 1].text = `(${notes.length}) ${notes[notes.length - 1].text}`;
    }
  }

  const rows = generateExpressions(model);
  for (const row of rows) {
    if (row.physical || row.kind === "universe") continue;
    const v = readValue(model, row).trim();
    if (v) notes.push({ id: row.id, text: `${displayLabel(row, model)} = ${v}`, highlightKey: row.id });
  }

  const outsideText = (model.regions.find((r) => r.key === "")?.text ?? "").trim();
  const uText = (model.expressions?.universe ?? "").trim();

  const circleBottom = visible.length ? Math.max(...visible.map((s) => s.cy + s.radius)) : model.height;
  const baseBottom = Math.max(model.height, circleBottom + 24);
  const notesTop = baseBottom + (notes.length ? 8 : 0);
  const height = notesTop + notes.length * LINE_H + (notes.length ? 8 : 0);
  const labelsRight = visible.length ? Math.max(...visible.map((s) => s.cx + Math.max(s.radius, textWidth(s.label, 13) / 2))) : 0;
  const noteW = notes.reduce((m, n) => Math.max(m, textWidth(n.text, NOTE_FONT) + 24), 0);
  const width = Math.max(model.width, labelsRight + 12, noteW);

  const res: VennLayoutResult = { values, notes, width, height, notesTop };
  if (outsideText) res.outside = { text: outsideText, x: width - 14, y: baseBottom - 14 };
  if (uText && model.universe.show) res.universe = { text: `U = ${uText}`, x: 14, y: 20 };
  return res;
}
