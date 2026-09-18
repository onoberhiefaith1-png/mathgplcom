// Live performance numbers for the effect renderer.
//
// The overlay reads this store; the renderer writes to it. Development only —
// nothing here is mounted in a published game.

export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  worstMs: number;
  drawCalls: number;
  triangles: number;
  activeEffects: number;
  /** Render loops currently running. One canvas = one loop, always. */
  loops: number;
  /** How long the last selected effect took to become ready, in ms. */
  readyMs: number;
  readyLabel: string;
}

let snapshot: PerfSnapshot = {
  fps: 0,
  frameMs: 0,
  worstMs: 0,
  drawCalls: 0,
  triangles: 0,
  activeEffects: 0,
  loops: 0,
  readyMs: 0,
  readyLabel: "—",
};

const listeners = new Set<() => void>();

export function perfSnapshot() {
  return snapshot;
}

export function setPerf(patch: Partial<PerfSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function subscribePerf(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every render loop registers itself, so a duplicate loop is impossible to miss. */
export function registerLoop() {
  setPerf({ loops: snapshot.loops + 1 });
  return () => setPerf({ loops: Math.max(0, snapshot.loops - 1) });
}

export function resetWorst() {
  setPerf({ worstMs: 0 });
}
