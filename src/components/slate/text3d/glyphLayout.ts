// Shared glyph placement for the per-character renderers.
//
// Troika lays the text out once (wrapping, line breaks, alignment). We read
// its caret data back and turn it into one box per visible character, so the
// tile and extruded renderers place physical objects exactly where the plain
// inscription would have drawn a letter.

import type { TroikaTextRenderInfo } from "troika-three-text";

export interface GlyphBox {
  index: number;
  char: string;
  /** Centre of the glyph cell, in local text space. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function glyphBoxes(text: string, info: TroikaTextRenderInfo | null): GlyphBox[] {
  const caret = info?.caretPositions;
  if (!caret) return [];
  const out: GlyphBox[] = [];
  const count = Math.min(text.length, Math.floor(caret.length / 4));
  for (let i = 0; i < count; i++) {
    const char = text[i] ?? "";
    if (!char.trim()) continue;
    const base = i * 4;
    const left = caret[base] ?? 0;
    const right = caret[base + 1] ?? left;
    const bottom = caret[base + 2] ?? 0;
    const top = caret[base + 3] ?? bottom;
    const w = Math.abs(right - left);
    const h = Math.abs(top - bottom);
    if (w < 1e-5 || h < 1e-5) continue;
    out.push({
      index: i,
      char,
      x: (left + right) / 2,
      y: (bottom + top) / 2,
      w,
      h,
    });
  }
  return out;
}
