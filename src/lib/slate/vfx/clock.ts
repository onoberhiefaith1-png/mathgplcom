// One authoritative clock for every running effect.
//
// Effects never chain setTimeout calls or step through stages: they read a
// single continuously advancing time value and interpolate. Pausing simply
// stops that value from advancing, so an effect freezes exactly where it is
// and resumes from the same place — the render loop itself never stops.

let offset = 0;
let last: number | null = null;
let paused = false;

/** Called once per frame with the renderer's elapsed time. */
export function advanceEffectClock(elapsed: number) {
  if (last !== null && paused) offset += elapsed - last;
  last = elapsed;
}

/** Effect time: real elapsed time minus everything spent paused. */
export function effectNow(clock: { elapsedTime: number }) {
  return clock.elapsedTime - offset;
}

export function setEffectsPaused(value: boolean) {
  paused = value;
}

export function effectsPaused() {
  return paused;
}
