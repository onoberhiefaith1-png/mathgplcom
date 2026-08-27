// Transport-level guarantees for the live SmartBoard broadcast pipeline:
// deltas must be minimal (so a keystroke is a tiny socket frame, not a full
// board), and a receiver must be able to rebuild the exact board from them.
import { describe, expect, it } from "vitest";
import {
  BROADCAST_INTERVAL_MS,
  MAX_BROADCAST_BYTES,
  diffBoardState,
  type BoardDelta,
  type BoardState,
} from "@/hooks/useSmartboardSync";

const base = (): BoardState => ({
  beatCursor: 0,
  bandExtra: {},
  freeLines: { 1: "x" },
  lineOffsets: {},
  smartLines: [{ id: "a" }],
  boxes: [],
  sensor: { line: 1, x: 0 },
  zoom: 1,
  surface: "board",
  profileId: "default",
  inkColorId: "ink",
  placeholderColorId: "grey",
});

/** Mirror of the receiver-side merge in useSmartboardSync.applyDelta. */
function applyDeltas(deltas: BoardDelta[]): BoardState | null {
  let current: BoardState | null = null;
  let lastSeq = 0;
  for (const d of deltas) {
    if (d.seq <= lastSeq) continue;
    lastSeq = d.seq;
    current = { ...(d.full ? {} : (current ?? {})), ...d.patch } as BoardState;
  }
  return current;
}

describe("board sync deltas", () => {
  it("sends the whole state on the first frame", () => {
    const patch = diffBoardState(null, base());
    expect(Object.keys(patch).sort()).toEqual(Object.keys(base()).sort());
  });

  it("sends only changed fields afterwards", () => {
    const prev = base();
    const next = { ...prev, sensor: { line: 2, x: 5 } };
    expect(diffBoardState(prev, next)).toEqual({ sensor: { line: 2, x: 5 } });
  });

  it("sends nothing when nothing changed", () => {
    expect(diffBoardState(base(), base())).toEqual({});
  });

  it("detects deep changes inside board collections", () => {
    const prev = base();
    const next = { ...prev, smartLines: [{ id: "a" }, { id: "b" }] };
    expect(Object.keys(diffBoardState(prev, next))).toEqual(["smartLines"]);
  });

  it("a receiver rebuilds the exact board from full + incremental frames", () => {
    const s1 = base();
    const s2 = { ...s1, zoom: 1.5 };
    const s3 = { ...s2, boxes: [{ id: "box" }] };
    const rebuilt = applyDeltas([
      { seq: 1, author: "t", ts: 1, full: true, patch: diffBoardState(null, s1) },
      { seq: 2, author: "t", ts: 2, full: false, patch: diffBoardState(s1, s2) },
      { seq: 3, author: "t", ts: 3, full: false, patch: diffBoardState(s2, s3) },
    ]);
    expect(rebuilt).toEqual(s3);
  });

  it("ignores stale / out-of-order frames", () => {
    const s1 = base();
    const s2 = { ...s1, zoom: 3 };
    const rebuilt = applyDeltas([
      { seq: 1, author: "t", ts: 1, full: true, patch: diffBoardState(null, s1) },
      { seq: 3, author: "t", ts: 3, full: false, patch: { zoom: 3 } },
      { seq: 2, author: "t", ts: 2, full: false, patch: { zoom: 99 } },
    ]);
    expect(rebuilt?.zoom).toBe(s2.zoom);
  });

  it("keeps an ordinary edit far below the socket frame ceiling", () => {
    const prev = base();
    const next = { ...prev, sensor: { line: 4, x: 12 } };
    const frame = JSON.stringify({
      seq: 2, author: "t", ts: Date.now(), full: false, patch: diffBoardState(prev, next),
    });
    expect(frame.length).toBeLessThan(MAX_BROADCAST_BYTES / 100);
  });

  it("publishes on a sub-frame cadence, not a multi-second timer", () => {
    expect(BROADCAST_INTERVAL_MS).toBeLessThanOrEqual(50);
  });
});
