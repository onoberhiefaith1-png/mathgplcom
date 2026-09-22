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

export interface VisualTextLine {
  text: string;
  top: number;
}

const estimatedCharsPerLine = (fontSize: number, width: number) =>
  Math.max(1, Math.floor(Math.max(0.001, width) / Math.max(0.001, fontSize * 0.58)));

const splitVisualLine = (
  out: VisualTextLine[],
  text: string,
  top: number,
  charsPerLine: number,
  rowStep: number,
) => {
  const clean = text.replace(/\s+$/u, "");
  if (!clean) return;
  for (let start = 0, row = 0; start < clean.length; start += charsPerLine, row += 1) {
    out.push({ text: clean.slice(start, start + charsPerLine), top: top - row * rowStep });
  }
};

/**
 * Visible 3D faces must never draw past their writing surface. Troika's hidden
 * layout pass remains the source for caret and wrapping, but this guard also
 * splits long unbroken strings when a browser/font combination reports them as
 * one visual row.
 */
export function visualTextLines(
  text: string,
  info: TroikaTextRenderInfo | null,
  fontSize: number,
  width: number,
  lineSpacing = 1.25,
): VisualTextLine[] {
  if (!text) return [];
  const charsPerLine = estimatedCharsPerLine(fontSize, width);
  const rowStep = Math.max(fontSize, fontSize * Math.max(1, lineSpacing));
  const out: VisualTextLine[] = [];
  const caret = info?.caretPositions;
  if (!caret || caret.length < 4) {
    text.split("\n").forEach((line, index) => {
      splitVisualLine(out, line, -index * rowStep, charsPerLine, rowStep);
    });
    return out;
  }

  let start = 0;
  let currentTop = caret[3] ?? 0;
  const count = Math.min(text.length, Math.floor(caret.length / 4));
  for (let i = 0; i < count; i += 1) {
    const top = caret[i * 4 + 3] ?? currentTop;
    if (Math.abs(top - currentTop) > 0.0001 || text[i - 1] === "\n") {
      splitVisualLine(out, text.slice(start, i), currentTop, charsPerLine, rowStep);
      start = i;
      currentTop = top;
    }
  }
  splitVisualLine(out, text.slice(start, count), currentTop, charsPerLine, rowStep);
  return out;
}

export function glyphBoxesInsideWidth(
  boxes: GlyphBox[],
  width: number,
  align: "left" | "center" | "right",
) {
  const { left: leftEdge, right: rightEdge } = textLocalHorizontalBounds(width, align);
  return boxes.every((box) => box.x - box.w / 2 >= leftEdge - 0.04 && box.x + box.w / 2 <= rightEdge + 0.04);
}

export interface HorizontalContainment {
  /** Translation in the renderer's local text coordinates. */
  shiftX: number;
  /** False only when the visible glyph span cannot fit at the saved size. */
  fits: boolean;
  left: number;
  right: number;
}

export function containHorizontalSpan(
  left: number,
  right: number,
  width: number,
  align: "left" | "center" | "right",
): HorizontalContainment {
  const legal = textLocalHorizontalBounds(width, align);
  const span = Math.max(0, right - left);
  if (span > legal.right - legal.left + 0.001) {
    return { shiftX: 0, fits: false, left, right };
  }
  let shiftX = 0;
  if (left < legal.left) shiftX += legal.left - left;
  if (right + shiftX > legal.right) shiftX -= right + shiftX - legal.right;
  return { shiftX, fits: true, left: left + shiftX, right: right + shiftX };
}

/**
 * Final raised-object guard. Troika's anchor determines the legal local range;
 * physical glyphs are translated back into that exact range when a font or
 * alignment reports a shifted caret box. If their span is genuinely too wide,
 * the caller keeps the physical pass invisible and uses its wrapped safe pass.
 */
export function containGlyphBoxes(
  boxes: GlyphBox[],
  width: number,
  align: "left" | "center" | "right",
): HorizontalContainment {
  const legal = textLocalHorizontalBounds(width, align);
  if (boxes.length === 0) return { shiftX: 0, fits: true, ...legal };
  const left = Math.min(...boxes.map((box) => box.x - box.w / 2));
  const right = Math.max(...boxes.map((box) => box.x + box.w / 2));
  return containHorizontalSpan(left, right, width, align);
}

export function textLocalHorizontalBounds(
  width: number,
  align: "left" | "center" | "right",
) {
  const safeWidth = Math.max(0.001, width);
  return align === "left"
    ? { left: 0, right: safeWidth }
    : align === "right"
      ? { left: -safeWidth, right: 0 }
      : { left: -safeWidth / 2, right: safeWidth / 2 };
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
