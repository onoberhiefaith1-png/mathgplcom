// Pure Floating Numbers chip operations for the ChatGPT connector. The tool
// applies these to the saved floating_lines of a question session; the open
// Smartboard or Floating Numbers page then re-reads the same saved data, so
// both screens stay identical. Uses the same helpers as the voice Tutor.

import {
  deleteChip,
  keepTogether,
  mergeChips,
  moveChip,
  type ChipLine,
} from "@/lib/assistant/floatingOps";

export const FLOATING_ACTIONS = ["delete", "move", "merge", "keep_together"] as const;
export type FloatingAction = (typeof FLOATING_ACTIONS)[number];

export interface FloatingOpArgs {
  n?: number;
  from?: number;
  to?: number;
  numbers?: number[];
  a?: string;
  b?: string;
}

export type FloatingOpResult<T extends ChipLine> =
  | { ok: true; lines: T[]; chips: string[] }
  | { ok: false; error: string };

/** Apply one chip operation to line `line` (1-based) of a question's lines. */
export function applyFloatingOp<T extends ChipLine & { lineId?: string }>(
  lines: T[],
  line: number,
  action: FloatingAction,
  args: FloatingOpArgs,
): FloatingOpResult<T> {
  if (!Array.isArray(lines) || lines.length === 0)
    return { ok: false, error: "This question has no Floating Numbers yet." };
  if (!Number.isInteger(line) || line < 1 || line > lines.length)
    return { ok: false, error: `Line must be between 1 and ${lines.length}.` };
  const target = lines[line - 1]!;
  let next: T | null = null;
  switch (action) {
    case "delete":
      next = deleteChip(target, Number(args.n));
      break;
    case "move":
      next = moveChip(target, Number(args.from), Number(args.to));
      break;
    case "merge":
      next = mergeChips(target, Array.isArray(args.numbers) ? args.numbers.map(Number) : []);
      break;
    case "keep_together":
      next = keepTogether(target, String(args.a ?? ""), String(args.b ?? ""));
      break;
  }
  if (!next)
    return { ok: false, error: "Those numbers/symbols were not found on that line." };
  const out = lines.map((l, i) => (i === line - 1 ? next! : l));
  return { ok: true, lines: out, chips: next.fillers };
}
