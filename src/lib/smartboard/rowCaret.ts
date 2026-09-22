// GAME MIRROR — read-only decoration of a Smartboard row for the Game Slate.
//
// The Game engraves each line's plain working onto its physical writing
// surface. On the Smartboard the student can SEE where the sensor sits and see
// the empty slot of a bracket / fraction / exponent. A flat ASCII mirror loses
// both, so this module rebuilds the SAME row with two read-only marks added:
//
//   • the sensor position, as a thin caret glyph
//   • every empty structural slot, as a placeholder box
//
// Nothing here edits the board: the row is cloned, the marks are inserted into
// the clone, and the clone is flattened with the existing rowToAscii. There is
// one cursor authority (the Smartboard's own live cursor) and one text source.

import {
  type Cursor,
  type Node,
  type Row,
  SLOT_GLYPH,
  subRowsOf,
} from "./mathTree";
import { rowToAscii } from "./rowAscii";

/** The sensor mark drawn into the mirrored text. */
export const SENSOR_GLYPH = "|";

const charNode = (ch: string): Node => ({ kind: "char", ch });

const cloneNode = (n: Node): Node =>
  n.kind === "char" ? { ...n } : ({ ...n, rows: subRowsOf(n).map(cloneRow) } as Node);

const cloneRow = (row: Row): Row => row.map(cloneNode);

/** Fill every empty sub-row with the placeholder box, so an untouched bracket
 *  body reads `( □ )` in the mirror instead of collapsing to `()`. */
const markEmptySlots = (row: Row): Row =>
  row.map((n) => {
    if (n.kind === "char") return n;
    const rows = subRowsOf(n).map((sub) =>
      sub.length === 0 ? [charNode(SLOT_GLYPH)] : markEmptySlots(sub),
    );
    return { ...n, rows } as Node;
  });

/** Insert the sensor mark into the row the cursor points at. */
const markSensor = (row: Row, cursor: Cursor): Row => {
  const walk = (current: Row, path: number[]): Row => {
    if (path.length === 0) {
      const index = Math.max(0, Math.min(current.length, cursor.index));
      return [...current.slice(0, index), charNode(SENSOR_GLYPH), ...current.slice(index)];
    }
    const [nodeIdx, subIdx, ...rest] = path;
    const node = current[nodeIdx];
    if (!node || node.kind === "char") return current;
    const rows = subRowsOf(node);
    const target = rows[subIdx];
    if (!target) return current;
    const nextRows = rows.map((sub, i) => (i === subIdx ? walk(sub, rest) : sub));
    const nextNode = { ...node, rows: nextRows } as Node;
    return current.map((item, i) => (i === nodeIdx ? nextNode : item));
  };
  return walk(row, cursor.path);
};

/* ── raised / lowered scripts ────────────────────────────────────────────────
   The writing surface engraves ONE line of characters, so an exponent written
   as `^(□)` reads like brackets rather than the raised cell it is. Where every
   character of a script has a raised (or lowered) form, the script is written
   with those forms — `12²`, `x₁` — and an empty cell is drawn as a raised or
   lowered placeholder box attached to its base. Anything that cannot be raised
   (including the sensor mark) falls back to the plain `^(…)` / `_(…)` form, so
   nothing is ever hidden. */

const SUPER_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
  "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼",
  "(": "⁽", ")": "⁾", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ",
  g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ",
  p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ",
  z: "ᶻ", [SLOT_GLYPH]: "⁽□⁾",
};

const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
  "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌",
  "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ",
  l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ",
  v: "ᵥ", x: "ₓ", [SLOT_GLYPH]: "₍□₎",
};

/** A script row raised/lowered, or null when any character has no such form. */
const scriptText = (row: Row, dir: "sup" | "sub"): string | null => {
  const map = dir === "sup" ? SUPER_MAP : SUB_MAP;
  let out = "";
  for (const node of row) {
    if (node.kind !== "char") return null;
    const mapped = map[node.ch] ?? map[node.ch.toLowerCase()];
    if (!mapped) return null;
    out += mapped;
  }
  return out;
};

const mirrorRow = (row: Row): string => row.map(mirrorNode).join("");

function mirrorNode(node: Node): string {
  if (node.kind === "char") return node.ch;
  const rows = subRowsOf(node);
  switch (node.kind) {
    case "sup": {
      const raised = scriptText(rows[0] ?? [], "sup");
      return raised ?? `^(${mirrorRow(rows[0] ?? [])})`;
    }
    case "sub": {
      const lowered = scriptText(rows[0] ?? [], "sub");
      return lowered ?? `_(${mirrorRow(rows[0] ?? [])})`;
    }
    case "power": {
      const base = mirrorRow(rows[0] ?? []);
      const raised = scriptText(rows[1] ?? [], "sup");
      return raised !== null ? `${base}${raised}` : `${base}^(${mirrorRow(rows[1] ?? [])})`;
    }
    case "subsup": {
      const base = mirrorRow(rows[0] ?? []);
      const lowered = scriptText(rows[1] ?? [], "sub");
      const raised = scriptText(rows[2] ?? [], "sup");
      const low = lowered !== null ? lowered : `_(${mirrorRow(rows[1] ?? [])})`;
      const high = raised !== null ? raised : `^(${mirrorRow(rows[2] ?? [])})`;
      return `${base}${low}${high}`;
    }
    case "bracket":
      return `${node.left}${mirrorRow(rows[0] ?? [])}${node.right}`;
    case "frac":
      return `(${mirrorRow(rows[0] ?? [])})/(${mirrorRow(rows[1] ?? [])})`;
    case "sqrt":
      return rows.length > 1
        ? `root(${mirrorRow(rows[1] ?? [])},${mirrorRow(rows[0] ?? [])})`
        : `sqrt(${mirrorRow(rows[0] ?? [])})`;
    case "box":
    case "georef":
    case "accent":
      return mirrorRow(rows[0] ?? []);
    default:
      // Everything else keeps the shared flattener's shape.
      return rowToAscii([node]);
  }
}

/**
 * Flatten a row for the Game surface. `cursor` is the Smartboard's live cursor
 * and is only honoured for the row the student is writing on.
 */
export const rowToGameMirror = (row: Row, cursor?: Cursor | null): string => {
  const decorated = markEmptySlots(cloneRow(row));
  const withSensor = cursor ? markSensor(decorated, cursor) : decorated;
  return mirrorRow(withSensor);
};
