// Pure Floating Number operations Tutor performs by voice. Positions are the
// teacher's 1-based numbers as shown on screen.

export type ChipLine = { fillers: string[]; arrangement?: number[]; fillersSelected?: boolean[] };

const reset = <T extends ChipLine>(line: T, fillers: string[]): T => ({
  ...line,
  fillers,
  arrangement: fillers.map((_, i) => i),
  fillersSelected: fillers.map(() => false),
});

const valid = (line: ChipLine, n: number) => Number.isInteger(n) && n >= 1 && n <= line.fillers.length;

export function deleteChip<T extends ChipLine>(line: T, n: number): T | null {
  if (!valid(line, n)) return null;
  return reset(line, line.fillers.filter((_, i) => i !== n - 1));
}

export function moveChip<T extends ChipLine>(line: T, from: number, to: number): T | null {
  if (!valid(line, from) || !valid(line, to)) return null;
  const next = [...line.fillers];
  const [chip] = next.splice(from - 1, 1);
  next.splice(to - 1, 0, chip!);
  return reset(line, next);
}

/** Merge a run of numbered chips into one chip, kept in their original order. */
export function mergeChips<T extends ChipLine>(line: T, numbers: number[]): T | null {
  const picked = [...new Set(numbers)].sort((a, b) => a - b);
  if (picked.length < 2 || !picked.every((n) => valid(line, n))) return null;
  const merged = picked.map((n) => line.fillers[n - 1]!.trim()).join(" ");
  const out: string[] = [];
  line.fillers.forEach((chip, i) => {
    if (i === picked[0]! - 1) out.push(merged);
    else if (!picked.includes(i + 1)) out.push(chip);
  });
  return reset(line, out);
}

/** Keep two symbols side by side, e.g. "=" with the fraction bar. */
export function keepTogether<T extends ChipLine>(line: T, a: string, b: string): T | null {
  const ia = line.fillers.findIndex((c) => c.includes(a));
  const ib = line.fillers.findIndex((c, i) => i !== ia && c.includes(b));
  if (ia < 0 || ib < 0) return null;
  if (Math.abs(ia - ib) === 1) return line;
  return moveChip(line, ib + 1, ia < ib ? ia + 2 : ia + 1);
}
