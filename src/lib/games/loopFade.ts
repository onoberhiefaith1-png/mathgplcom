/**
 * Loop-seam smoothing. A looping building jumps from its last frame back to its
 * first one, and when those two frames differ the jump reads as a flash. Fading
 * the very end and the very beginning of the clip by the same tiny amount makes
 * one revolution run into the next with nothing to see.
 *
 * Returns the opacity multiplier for a playhead position, 0..1.
 */
export const seamAlpha = (time: number, duration: number, fade: number): number => {
  if (!fade || !Number.isFinite(duration) || duration <= fade * 2) return 1;
  const fromStart = Math.max(0, time);
  const toEnd = Math.max(0, duration - time);
  return Math.max(0, Math.min(1, Math.min(fromStart, toEnd) / fade));
};
