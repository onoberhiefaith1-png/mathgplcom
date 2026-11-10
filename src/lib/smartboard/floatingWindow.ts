/** Pure maths for the five-at-a-time Floating Numbers strip. Linear, never
 *  wraps: the left control stops at the start, the right stops at the end. */
export const FLOATING_WINDOW_SIZE = 5;

export const maxWindowOffset = (count: number, visible = FLOATING_WINDOW_SIZE) =>
  Math.max(0, count - Math.max(0, visible));

export const clampWindowOffset = (offset: number, count: number, visible = FLOATING_WINDOW_SIZE) =>
  Math.min(Math.max(0, Math.trunc(offset) || 0), maxWindowOffset(count, visible));

export const windowRange = (offset: number, count: number, visible = FLOATING_WINDOW_SIZE) => {
  const start = clampWindowOffset(offset, count, visible);
  return { start, end: Math.min(count, start + Math.max(0, visible)) };
};

export const canWindowBack = (offset: number) => offset > 0;
export const canWindowForward = (offset: number, count: number, visible = FLOATING_WINDOW_SIZE) =>
  offset < maxWindowOffset(count, visible);

export type TrayChip = { token: string; absIdx: number; used: boolean };

/**
 * Build the visible Floating Numbers strip.
 * Always exactly `windowSize` chips when any number exists: unused chips occupy
 * the window, extras sit to the right (via unusedOffset), used history is
 * revealed on the left, and a short pool is repeated / recycled oldest-first
 * so the student can stack digits (22, 222).
 */
export function buildFiveChipStrip(input: {
  remaining: Array<{ token: string; absIdx: number }>;
  usedNewestFirst: Array<{ token: string; absIdx: number }>;
  usedOldestFirst: Array<{ token: string; absIdx: number }>;
  allSlots: Array<{ token: string; absIdx: number }>;
  reveal?: number;
  unusedOffset?: number;
  recycleOffset?: number;
  windowSize?: number;
}): TrayChip[] {
  const windowSize = input.windowSize ?? FLOATING_WINDOW_SIZE;
  const remaining = input.remaining;
  const usedNew = input.usedNewestFirst;
  const usedOld = input.usedOldestFirst;
  const all = input.allSlots;
  if (remaining.length === 0 && usedOld.length === 0 && all.length === 0) return [];

  const reveal = Math.max(0, Math.min(Math.floor(input.reveal ?? 0), usedNew.length));
  const leftUsed: TrayChip[] = usedNew.slice(0, reveal).map((slot) => ({ ...slot, used: true }));
  const needed = Math.max(0, windowSize - leftUsed.length);

  const offset = clampWindowOffset(input.unusedOffset ?? 0, remaining.length, needed);
  const unusedSlice: TrayChip[] = [];
  if (remaining.length > 0 && needed > 0) {
    const { start, end } = windowRange(offset, remaining.length, needed);
    for (let i = start; i < end; i++) unusedSlice.push({ ...remaining[i]!, used: false });
  }

  const stillNeeded = needed - unusedSlice.length;
  const cyclePool = remaining.length > 0
    ? [...remaining, ...usedOld]
    : (usedOld.length > 0 ? usedOld : all);
  const fill = [...unusedSlice];
  if (stillNeeded > 0 && cyclePool.length > 0) {
    const start = remaining.length > 0 ? fill.length : Math.max(0, Math.floor(input.recycleOffset ?? 0));
    for (let i = 0; i < stillNeeded; i++) {
      const slot = cyclePool[(start + i) % cyclePool.length]!;
      fill.push({ ...slot, used: false });
    }
  }
  return [...leftUsed, ...fill].slice(0, windowSize);
}
