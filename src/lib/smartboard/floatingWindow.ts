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
