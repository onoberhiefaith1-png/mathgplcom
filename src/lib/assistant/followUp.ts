// A request Tutor could not finish yet (its screen wasn't open). It waits for a
// follow-up like "done" or "I have opened it" and runs once — never twice.

const FOLLOW_UP = /^\s*(?:ok(?:ay)?|yes|yeah|yep|done|ready|now|go|go ahead|continue|try again|it'?s (?:open|opened|there)|(?:i|i've|i have|i'?ve)\s+(?:have\s+)?(?:open|opened|done)(?:\s+it)?|opened(?:\s+it)?|open(?:ed)? now|it is open)\b/i;

/** Does this reply just mean "carry on with what I asked"? */
export const isFollowUp = (text: string) => FOLLOW_UP.test(text.trim());

export type Awaiting = { name: string; args: Record<string, unknown>; until: number };
export const AWAIT_MS = 2 * 60 * 1000;

/** Holds at most one waiting request; take() hands it out exactly once. */
export class AwaitingSlot {
  private item: Awaiting | null = null;
  set(name: string, args: Record<string, unknown>, now = Date.now()) { this.item = { name, args, until: now + AWAIT_MS }; }
  peek(now = Date.now()): Awaiting | null {
    if (this.item && now > this.item.until) this.item = null;
    return this.item;
  }
  take(now = Date.now()): Awaiting | null {
    const it = this.peek(now);
    this.item = null;
    return it;
  }
  clear() { this.item = null; }
}
