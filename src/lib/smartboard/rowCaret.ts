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

/**
 * Flatten a row for the Game surface. `cursor` is the Smartboard's live cursor
 * and is only honoured for the row the student is writing on.
 */
export const rowToGameMirror = (row: Row, cursor?: Cursor | null): string => {
  const decorated = markEmptySlots(cloneRow(row));
  const withSensor = cursor ? markSensor(decorated, cursor) : decorated;
  return rowToAscii(withSensor);
};
