/**
 * Reward presentation is one-way: the Game emits events, this guard decides
 * whether a picture may play. It never touches Game state, so an animation
 * that fails or is skipped cannot change lives, score or the mathematics.
 */
export const MAX_ACTIVE_REWARD_FLIGHTS = 6;
export const MAX_REWARD_TIMERS = 64;

export function createRewardPresentationGuard() {
  const played = new Set<string>();
  return {
    /** A placed reward plays its live effect once; re-announcements are ignored. */
    admit(rewardId: string, preview: boolean): boolean {
      if (preview) return true;
      if (played.has(rewardId)) return false;
      played.add(rewardId);
      return true;
    },
    reset() { played.clear(); },
    size: () => played.size,
  };
}

/** Collects consume calls and flushes them together, outside the event that caused them. */
export function createBatchedConsumer(
  consume: (slotId: string, rewardId: string) => void,
  schedule: (flush: () => void) => void,
) {
  let queue: Array<[string, string]> = [];
  let pending = false;
  return (slotId: string, rewardId: string) => {
    queue.push([slotId, rewardId]);
    if (pending) return;
    pending = true;
    schedule(() => {
      const work = queue;
      queue = [];
      pending = false;
      for (const [s, r] of work) {
        try { consume(s, r); } catch { /* a failed reward never stops the Game */ }
      }
    });
  };
}
