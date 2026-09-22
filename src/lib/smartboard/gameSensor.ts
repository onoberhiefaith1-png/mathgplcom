// GAME SENSOR — vertical sensor movement for the Game writing surface.
//
// The Game uses the Smartboard's mathematics tree, cursor and placeholder
// model unchanged. The only thing it needs of its own is a SAFE vertical step:
//
//   • it may enter a script / fraction slot that really exists at the sensor
//   • it may step between the slots of the structure the sensor is inside
//   • it may step back out of a script slot onto the baseline
//   • it does NOTHING otherwise — never a line change, never a new structure
//
// The Smartboard keeps its own `nudgeCursor`, which falls back to changing
// board row; inside a Game that would throw the student off the Game Line.

import {
  exitContainerRight,
  getRowAt,
  moveDown,
  moveUp,
  subRowsOf,
  type Cursor,
  type Node,
  type Row,
} from "./mathTree";

/** Slot index that sits ABOVE the baseline for this container, if any. */
const upperSlot = (node: Node): number | null => {
  switch (node.kind) {
    case "power": return 1;   // [base, exp]
    case "sup": return 0;
    case "subsup": return 2;  // [base, sub, sup]
    case "frac": return 0;    // numerator
    case "sqrt": return 0;    // radicand sits above the baseline stroke
    default: return null;
  }
};

/** Slot index that sits BELOW the baseline for this container, if any. */
const lowerSlot = (node: Node): number | null => {
  switch (node.kind) {
    case "sub": return 0;
    case "subsup": return 1;
    case "frac": return 1;    // denominator
    default: return null;
  }
};

/** The container the sensor is sitting beside: the node it is on, else the
 *  node immediately to its left. */
const adjacentContainer = (
  row: Row,
  index: number,
): { node: Node; nodeIdx: number } | null => {
  const here = row[index];
  if (here && here.kind !== "char") return { node: here, nodeIdx: index };
  const left = index > 0 ? row[index - 1] : undefined;
  if (left && left.kind !== "char") return { node: left, nodeIdx: index - 1 };
  return null;
};

/**
 * One vertical sensor step inside the current line. `dir` is -1 for ↑, 1 for ↓.
 * Returns null when there is no valid mathematical destination — the caller
 * must then do nothing at all.
 */
export const gameMoveVertical = (
  root: Row,
  cursor: Cursor,
  dir: -1 | 1,
): Cursor | null => {
  const row = getRowAt(root, cursor.path);

  // 1. Enter a real slot of the structure beside the sensor.
  const adjacent = adjacentContainer(row, cursor.index);
  if (adjacent) {
    const slot = dir < 0 ? upperSlot(adjacent.node) : lowerSlot(adjacent.node);
    if (slot !== null) {
      const target = subRowsOf(adjacent.node)[slot] ?? [];
      return {
        path: [...cursor.path, adjacent.nodeIdx, slot],
        index: target.length,
      };
    }
  }

  if (cursor.path.length < 2) return null;

  // 2. Step between the slots of the structure the sensor is inside.
  if (dir < 0) {
    const next = moveUp(root, cursor);
    // moveUp also ESCAPES a structure when nothing sits above it. In the Game
    // ↑ must only ever go up, so an escape (shorter path) is refused.
    return next && next.path.length === cursor.path.length ? next : null;
  }

  const next = moveDown(root, cursor);
  if (next) return next;
  // 3. ↓ out of a script slot returns the sensor to the baseline.
  const out = exitContainerRight(root, cursor);
  return out.path.length < cursor.path.length ? out : null;
};

/** Whether the ↑ / ↓ key has anywhere to go from here. */
export const canGameMoveVertical = (
  root: Row,
  cursor: Cursor,
  dir: -1 | 1,
): boolean => {
  try {
    return gameMoveVertical(root, cursor, dir) !== null;
  } catch {
    return false;
  }
};
