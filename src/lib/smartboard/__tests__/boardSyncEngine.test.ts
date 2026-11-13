import { describe, expect, it } from "vitest";
import {
  BoardSyncPeer, cadenceFor, compareStamp, diffBoardState, hashBoard, stableStringify,
  type BoardSnapshot, type BoardState, type RowSnapshot,
} from "@/lib/smartboard/boardSyncEngine";
import { VirtualClock } from "@/lib/smartboard/sim/boardSyncSim";

const board = (over: Partial<BoardState> = {}): BoardState => ({
  beatCursor: 0, bandExtra: {}, freeLines: {}, lineOffsets: {}, smartLines: [], boxes: [],
  sensor: { line: 1, x: 0 }, zoom: 1, surface: "whiteboard", profileId: "p", inkColorId: "i",
  sourceNotebookId: "nb", sourceFingerprint: "fp", activeLineIdx: 0, lineEngaged: false, floating: null, ...over,
});
const strip = (s: BoardSnapshot): BoardState => { const { v: _v, author: _a, ts: _t, ...rest } = s; return rest as BoardState; };

type Msg = { from: string; event: string; payload: unknown };
/** A class on a virtual clock: frames are delivered after `latency`, in order, unless a filter drops them. */
function classroom(opts: { latency?: number; audience?: number } = {}) {
  const clock = new VirtualClock();
  const lat = opts.latency ?? 50;
  const sent: Msg[] = [];
  let row: RowSnapshot | null = null;
  const peers = new Map<string, { peer: BoardSyncPeer; online: boolean; shown: BoardState | null; fp: string }>();
  let drop: (m: Msg, to: string) => boolean = () => false;
  const add = (id: string, fp = "fp") => {
    const entry = { peer: null as unknown as BoardSyncPeer, online: false, shown: null as BoardState | null, fp };
    entry.peer = new BoardSyncPeer({
      clock, random: () => 0.5, config: { audience: opts.audience ?? 1 },
      selfId: () => id,
      identity: () => ({ notebookId: "nb", fingerprint: entry.fp }),
      send: (event, payload) => {
        const m = { from: id, event, payload: JSON.parse(JSON.stringify(payload)) };
        sent.push(m);
        if (!entry.online) return;
        for (const [to, p] of peers) {
          if (to === id || drop(m, to)) continue;
          clock.setTimeout(() => { if (p.online) p.peer.receive(event, m.payload); }, lat);
        }
      },
      onApply: (snap) => { entry.shown = strip(snap); },
      persist: (r) => { row = JSON.parse(JSON.stringify(r)); },
      loadRow: async () => (row ? JSON.parse(JSON.stringify(row)) : null),
    });
    peers.set(id, entry);
    return entry;
  };
  const connect = async (id: string) => {
    const e = peers.get(id)!; e.online = true; e.peer.connected(true);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const run = async (ms: number) => { await clock.runUntil(clock.now() + ms); for (let i = 0; i < 5; i++) await Promise.resolve(); await clock.runUntil(clock.now()); };
  return { clock, sent, add, connect, run, setDrop: (f: typeof drop) => { drop = f; }, row: () => row, setRow: (r: RowSnapshot | null) => { row = r; } };
}

describe("board sync engine: helpers", () => {
  it("hash ignores key order and null-vs-missing, but sees any real difference", () => {
    expect(hashBoard(board({ zoom: 2 }))).toBe(hashBoard({ ...board(), zoom: 2 }));
    expect(stableStringify({ a: 1, b: null })).toBe(stableStringify({ a: 1 }));
    expect(hashBoard(board({ sensor: { line: 1, x: 1 } }))).not.toBe(hashBoard(board()));
    expect(hashBoard(board({ freeLines: { 1: "ab" } }))).not.toBe(hashBoard(board({ freeLines: { 1: "ba" } })));
  });
  it("a field that disappears is sent as null, so receivers clear it", () => {
    const prev = board({ placeholderColorId: "grey" });
    const next = { ...prev }; delete next.placeholderColorId;
    expect(diffBoardState(prev, next)).toEqual({ placeholderColorId: null });
  });
  it("a later sender run wins; within a run the higher seq wins", () => {
    expect(compareStamp({ epoch: "b", epochAt: 20, seq: 1 }, { epoch: "a", epochAt: 10, seq: 99 })).toBeGreaterThan(0);
    expect(compareStamp({ epoch: "a", epochAt: 10, seq: 4 }, { epoch: "a", epochAt: 10, seq: 5 })).toBeLessThan(0);
  });
  it("sizes the send rate to the class so the realtime budget holds", () => {
    expect(cadenceFor({ minIntervalMs: 40, beatMs: 1000, eventsPerSecond: 0, audience: 1000 })).toEqual({ intervalMs: 40, beatMs: 1000 });
    const pro30 = cadenceFor({ minIntervalMs: 40, beatMs: 1000, eventsPerSecond: 400, audience: 30 });
    expect(pro30.intervalMs).toBeLessThan(120);
    // frames + heartbeats, each delivered to everyone, stay under the budget
    const perSecond = (n: number, c: { intervalMs: number; beatMs: number }) => (n + 1) * (1000 / c.intervalMs + 1000 / c.beatMs);
    for (const n of [10, 30, 100, 1000]) {
      const c = cadenceFor({ minIntervalMs: 40, beatMs: 1000, eventsPerSecond: 400, audience: n });
      expect(perSecond(n, c)).toBeLessThanOrEqual(400 * 0.96);
    }
  });
});

describe("board sync engine: a class", () => {
  it("a student joining mid-lesson while the teacher is idle gets the board at once (no waiting for the next move)", async () => {
    const c = classroom();
    const t = c.add("teacher");
    await c.connect("teacher");
    t.peer.update(board());
    for (let i = 1; i <= 20; i++) { t.peer.update(board({ sensor: { line: 2, x: i }, freeLines: { 2: "x".repeat(i) } })); await c.run(50); }
    await c.run(5000); // teacher stops; a student arrives later
    const s = c.add("student");
    await c.connect("student");
    await c.run(400);
    expect(s.shown).toEqual(board({ sensor: { line: 2, x: 20 }, freeLines: { 2: "x".repeat(20) } }));
  });

  it("a board that arrives before the lesson has loaded is kept and shown when it loads", async () => {
    const c = classroom();
    const t = c.add("teacher");
    await c.connect("teacher");
    t.peer.update(board({ zoom: 3 }));
    await c.run(100);
    const s = c.add("student", "loading");
    await c.connect("student");
    await c.run(600);
    expect(s.shown).toBeNull();
    s.fp = "fp"; s.peer.identityChanged();
    expect(s.shown?.zoom).toBe(3);
  });

  it("students present the teacher's Preview plan, so a skipped slide no longer blocks sync", async () => {
    const c = classroom();
    const t = c.add("teacher", "fp:skip3");
    await c.connect("teacher");
    const plans: Array<string[] | null> = [];
    const s = c.add("student", "fp:");
    // the student's board derives its lesson from the plan it is given
    (s.peer as unknown as { o: { onPlan: (nb: string | null, sk: string[] | null) => void } }).o.onPlan = (_nb, sk) => { plans.push(sk); s.fp = `fp:${(sk ?? []).join("")}`; queueMicrotask(() => s.peer.identityChanged()); };
    t.peer.update(board({ sourceFingerprint: "fp:skip3", planSkipped: ["skip3"], zoom: 2 }));
    await c.connect("student");
    await c.run(500);
    expect(plans.at(-1)).toEqual(["skip3"]);
    expect(s.shown?.zoom).toBe(2);
  });

  it("a lost frame is detected and repaired with a full board", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    const s = c.add("student"); await c.connect("student");
    t.peer.update(board()); await c.run(500);
    let dropNext = true;
    c.setDrop((m, to) => { const f = m.payload as { full?: boolean; patch?: Partial<BoardState> }; if (to === "student" && m.event === "state" && !f.full && dropNext && f.patch?.beatCursor === 1) { dropNext = false; return true; } return false; });
    t.peer.update(board({ beatCursor: 1 })); await c.run(150);
    t.peer.update(board({ beatCursor: 1, sensor: { line: 1, x: 5 } })); await c.run(150);
    expect(dropNext).toBe(false);
    // the sensor move shows straight away, the lost slide change is repaired by a full board
    await c.run(800);
    expect(s.shown).toEqual(board({ beatCursor: 1, sensor: { line: 1, x: 5 } }));
    expect(s.peer.metrics.gaps).toBeGreaterThan(0);
    expect(c.sent.some((m) => (m.event === "hello" || m.event === "want") && m.from === "student")).toBe(true);
  });

  it("an out-of-order (late) older frame never overwrites a newer board", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    const s = c.add("student"); await c.connect("student");
    t.peer.update(board()); await c.run(500);
    t.peer.update(board({ zoom: 2 })); await c.run(150);
    t.peer.update(board({ zoom: 3 })); await c.run(150);
    const old = c.sent.filter((m) => m.from === "teacher" && m.event === "state").find((m) => (m.payload as { patch: Partial<BoardState> }).patch.zoom === 2)!;
    s.peer.receive("state", old.payload);
    expect(s.shown?.zoom).toBe(3);
  });

  it("a silent difference (same version, different content) is caught by the heartbeat and corrected", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    const s = c.add("student"); await c.connect("student");
    t.peer.update(board({ zoom: 1.5 })); await c.run(300);
    // corrupt the student's copy without changing its version
    (s.peer as unknown as { merged: BoardState }).merged = board({ zoom: 9 });
    s.shown = board({ zoom: 9 });
    await c.run(2500);
    expect(s.peer.metrics.driftDetected).toBeGreaterThan(0);
    expect(s.shown?.zoom).toBe(1.5);
  });

  it("after being offline a student catches up on reconnect", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    const s = c.add("student"); await c.connect("student");
    t.peer.update(board()); await c.run(200);
    // offline: frames do not reach the student
    c.setDrop((_m, to) => to === "student");
    s.peer.connected(false);
    for (let i = 1; i <= 10; i++) { t.peer.update(board({ sensor: { line: 3, x: i } })); await c.run(80); }
    c.setDrop(() => false);
    s.peer.connected(true);
    await c.run(700);
    expect(s.shown?.sensor).toEqual({ line: 3, x: 10 });
  });

  it("many requests at once are answered by one full board, and others waiting stand down", async () => {
    const c = classroom({ audience: 200 });
    const t = c.add("teacher"); await c.connect("teacher");
    t.peer.update(board({ zoom: 4 })); await c.run(100);
    const students = Array.from({ length: 200 }, (_, i) => c.add(`s${i}`));
    // each student has random jitter in production; here spread them by hand
    let k = 0;
    for (const st of students) { (st.peer as unknown as { rand: () => number }).rand = () => (k++ % 200) / 200; }
    c.setRow(null); // nothing saved: everyone must ask
    await Promise.all(students.map((_st, i) => c.connect(`s${i}`)));
    await c.run(4000);
    expect(students.every((st) => st.shown?.zoom === 4)).toBe(true);
    const wants = c.sent.filter((m) => m.event === "hello").length;
    const fulls = c.sent.filter((m) => m.event === "state" && m.from === "teacher" && (m.payload as { full: boolean }).full).length;
    expect(wants).toBeLessThan(60); // most students heard the first answer before asking
    expect(fulls).toBeLessThan(15);
  });

  it("an older saved copy never replaces a newer live board; a saved copy alone is shown when no one is live", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    t.peer.update(board({ zoom: 5 })); await c.run(1500);
    const saved = c.row()!;
    expect(saved.syncSeq).toBeGreaterThan(0);
    const s = c.add("student"); await c.connect("student");
    await c.run(300);
    t.peer.update(board({ zoom: 6 })); await c.run(200);
    c.setRow({ ...saved, zoom: 5 });
    await s.peer.syncFromRow("test");
    expect(s.shown?.zoom).toBe(6);
    // teacher gone: a newcomer still sees the saved board
    t.peer.stop();
    const late = c.add("late"); await c.connect("late");
    await c.run(300);
    expect(late.shown?.zoom).toBe(5);
  });

  it("the teacher writes the saved copy at most once a second, and never stops writing it while busy", async () => {
    const c = classroom();
    const t = c.add("teacher"); await c.connect("teacher");
    for (let i = 0; i < 100; i++) { t.peer.update(board({ sensor: { line: 1, x: i } })); await c.run(50); } // 5s of constant writing
    expect(t.peer.metrics.persists).toBeGreaterThanOrEqual(5);
    expect(t.peer.metrics.persists).toBeLessThanOrEqual(7);
    await c.run(1100);
    expect(c.row()?.sensor).toEqual({ line: 1, x: 99 });
  });

  it("a student holding the board does not wipe the teacher's Academia, and its heartbeat does not trigger endless resyncs", async () => {
    const c = classroom();
    const t = c.add("teacher");
    const h = c.add("holder");
    const s = c.add("student");
    await c.connect("teacher"); await c.connect("holder"); await c.connect("student");
    const academia = { open: true } as unknown as BoardState["academia"];
    t.peer.update(board({ boardSurface: "academia", academia }));
    await c.run(1500);
    expect(s.shown?.academia).toEqual(academia);
    // The teacher hands the board to a student, whose frames never carry Academia.
    h.peer.update(board({ sensor: { line: 3, x: 1 } }));
    await c.run(500);
    expect(s.shown?.sensor).toEqual({ line: 3, x: 1 });
    expect(s.shown?.academia).toEqual(academia);
    expect(s.shown?.boardSurface).toBe("academia");
    const asked = () => c.sent.filter((m) => m.from === "student" && (m.event === "want" || m.event === "hello")).length;
    const before = asked();
    await c.run(8000);
    expect(asked() - before).toBeLessThanOrEqual(1);
  });
});
