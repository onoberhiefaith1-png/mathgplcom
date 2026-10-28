/**
 * When to read the teacher's text selection on the Floating Highlighting page.
 *
 * The page used to read it only on `mouseup` / `touchend`. Touch browsers
 * (iOS Safari, Android Chrome) build a selection with long-press and drag
 * handles and often fire neither, so highlighting did nothing. This reads it
 * on every end-of-gesture event (`pointerup`, `pointercancel`, `mouseup`,
 * `touchend`) and, as a safety net for handle dragging, on a debounced
 * `selectionchange`.
 *
 * A single gesture fires several of those events, so they are coalesced: at
 * most one capture is pending at a time, and the debounce never runs while a
 * pointer is down. The capture itself clears the selection, so a late event
 * finds nothing to read and cannot add a highlight twice.
 */

export interface SelectionTriggerOptions {
  /** Reads the current selection and adds the highlight. Must clear the selection. */
  capture: () => void;
  /** True when there is a non-collapsed selection worth capturing. */
  hasSelection: () => boolean;
  /** Quiet period after the last `selectionchange` before capturing. */
  debounceMs?: number;
  /** Defer to the next frame so the browser finishes updating the selection. */
  nextFrame?: (fn: () => void) => unknown;
  cancelFrame?: (handle: unknown) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface SelectionTrigger {
  pointerDown: () => void;
  gestureEnd: () => void;
  selectionChange: () => void;
  dispose: () => void;
}

export function createSelectionTrigger(
  opts: SelectionTriggerOptions,
): SelectionTrigger {
  const debounceMs = opts.debounceMs ?? 700;
  const nextFrame = opts.nextFrame ?? ((fn) => requestAnimationFrame(fn));
  const cancelFrame =
    opts.cancelFrame ?? ((h) => cancelAnimationFrame(h as number));
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    opts.clearTimer ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let pointerActive = false;
  let framePending: unknown = null;
  let hasFrame = false;
  let timer: unknown = null;
  let hasTimer = false;

  const stopTimer = () => {
    if (hasTimer) clearTimer(timer);
    timer = null;
    hasTimer = false;
  };

  const run = () => {
    stopTimer();
    if (!opts.hasSelection()) return;
    opts.capture();
  };

  return {
    pointerDown() {
      pointerActive = true;
      stopTimer();
    },
    gestureEnd() {
      pointerActive = false;
      stopTimer();
      if (hasFrame) return; // pointerup + mouseup + touchend of ONE gesture
      hasFrame = true;
      framePending = nextFrame(() => {
        hasFrame = false;
        framePending = null;
        run();
      });
    },
    selectionChange() {
      if (pointerActive) return; // still dragging: wait for the gesture to end
      if (!opts.hasSelection()) {
        stopTimer();
        return;
      }
      stopTimer();
      hasTimer = true;
      timer = setTimer(() => {
        hasTimer = false;
        timer = null;
        run();
      }, debounceMs);
    },
    dispose() {
      stopTimer();
      if (hasFrame) cancelFrame(framePending);
      hasFrame = false;
      framePending = null;
    },
  };
}
