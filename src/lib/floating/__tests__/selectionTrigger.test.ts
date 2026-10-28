import { describe, expect, it } from "vitest";
import { createSelectionTrigger } from "../selectionTrigger";

/** Manual frame / timer queues so ordering is deterministic. */
function harness(initialSelection = true) {
  let selection = initialSelection;
  let captures = 0;
  let frames: Array<() => void> = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const trigger = createSelectionTrigger({
    capture: () => {
      captures++;
      selection = false;
    }, // the real capture clears the selection
    hasSelection: () => selection,
    debounceMs: 700,
    nextFrame: (fn) => {
      frames.push(fn);
      return frames.length;
    },
    cancelFrame: () => {
      frames = [];
    },
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (h) => {
      timers.delete(h as number);
    },
  });
  return {
    trigger,
    select: () => {
      selection = true;
    },
    get captures() {
      return captures;
    },
    flushFrames: () => {
      const f = frames;
      frames = [];
      f.forEach((fn) => fn());
    },
    fireTimers: () => {
      const t = [...timers.values()];
      timers.clear();
      t.forEach(({ fn }) => fn());
    },
    get timerCount() {
      return timers.size;
    },
  };
}

describe("createSelectionTrigger", () => {
  it("captures once for a gesture that fires pointerup, mouseup and touchend", () => {
    const h = harness();
    h.trigger.pointerDown();
    h.trigger.gestureEnd();
    h.trigger.gestureEnd();
    h.trigger.gestureEnd();
    h.flushFrames();
    expect(h.captures).toBe(1);
  });

  it("does not double-add when a debounced selectionchange follows the gesture capture", () => {
    const h = harness();
    h.trigger.selectionChange();
    h.trigger.gestureEnd(); // cancels the pending debounce
    expect(h.timerCount).toBe(0);
    h.flushFrames();
    h.trigger.selectionChange(); // selection is now cleared
    h.fireTimers();
    expect(h.captures).toBe(1);
  });

  it("touch: a selection built by handles with no pointerup is captured after the debounce", () => {
    const h = harness();
    h.trigger.selectionChange();
    h.trigger.selectionChange();
    expect(h.timerCount).toBe(1); // restarted, not stacked
    h.fireTimers();
    expect(h.captures).toBe(1);
  });

  it("does not capture mid-drag while a pointer is down", () => {
    const h = harness();
    h.trigger.pointerDown();
    h.trigger.selectionChange();
    expect(h.timerCount).toBe(0);
    h.trigger.gestureEnd();
    h.flushFrames();
    expect(h.captures).toBe(1);
  });

  it("ignores an empty selection and clears a stale debounce", () => {
    const h = harness();
    h.trigger.selectionChange();
    expect(h.timerCount).toBe(1);
    h.trigger.selectionChange();
    h.fireTimers();
    expect(h.captures).toBe(1);
    const e = harness(false);
    e.trigger.selectionChange();
    expect(e.timerCount).toBe(0);
    e.trigger.gestureEnd();
    e.flushFrames();
    expect(e.captures).toBe(0);
  });

  it("allows a second, separate gesture after the first", () => {
    const h = harness();
    h.trigger.gestureEnd();
    h.flushFrames();
    h.select();
    h.trigger.gestureEnd();
    h.flushFrames();
    expect(h.captures).toBe(2);
  });

  it("dispose cancels pending work", () => {
    const h = harness();
    h.trigger.selectionChange();
    h.trigger.gestureEnd();
    h.trigger.dispose();
    h.flushFrames();
    h.fireTimers();
    expect(h.captures).toBe(0);
  });
});
