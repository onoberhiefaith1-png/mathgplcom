// Mounted production hook with a fake realtime channel and fake clock.
// Covers the classroom transport path a floating-number tap goes through.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

const sent: Array<{ event: string; payload: any }> = [];
const handlers = new Map<string, (m: { payload: unknown }) => void>();
let opts: any = null;

vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }), upsert: async () => ({ error: null }) };
  return { supabase: { auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) }, from: () => q } };
});
vi.mock("@/lib/stability/usePolling", () => ({ usePolling: () => undefined }));
vi.mock("@/lib/stability/useLiveChannel", () => ({
  useLiveChannel: (o: any) => { opts = o; },
}));

const { setupDom } = await import("@/test/domRender");
const { useSmartboardSync, BROADCAST_INTERVAL_MS } = await import("@/hooks/useSmartboardSync");
type BoardState = import("@/hooks/useSmartboardSync").BoardState;

const bigInk = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [i, "x".repeat(200)]));
const state = (activeLineIdx: number, usedOrder: string[]): BoardState => ({
  beatCursor: 0, bandExtra: {}, freeLines: bigInk, lineOffsets: {}, smartLines: [], boxes: [],
  sensor: { line: 1, x: 0 }, zoom: 1, surface: "whiteboard", profileId: "p", inkColorId: "i",
  sourceNotebookId: "nb", sourceFingerprint: "fp", activeLineIdx, lineEngaged: true,
  floating: { resId: "r", viewIdx: 0, activeIdx: 0, lineIdx: activeLineIdx, lines: [], usedOrder, reveal: 0, offset: 0, reentryOffset: 0 },
});

let api: ReturnType<typeof useSmartboardSync> | null = null;
let renders = 0;
function Probe() { renders += 1; api = useSmartboardSync({ classId: "c1", notebookId: "nb", sourceFingerprint: "fp", role: "teacher" }); return null; }

describe("useSmartboardSync (mounted, fake channel)", () => {
  let dom: ReturnType<typeof setupDom>;
  beforeEach(async () => {
    sent.length = 0; handlers.clear();
    dom = setupDom();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    await dom.render(<Probe />);
    await act(async () => { await Promise.resolve(); });
    const channel: any = {
      on: (_t: string, f: { event: string }, h: any) => { handlers.set(f.event, h); return channel; },
      send: (m: any) => { sent.push({ event: m.event, payload: m.payload }); return Promise.resolve("ok"); },
    };
    opts.build(channel);
    await act(async () => { opts.onStatus(true); opts.onJoined(); });
    sent.length = 0;
  });
  afterEach(async () => { vi.useRealTimers(); await dom.cleanup(); });

  const frames = () => sent.filter((f) => f.event === "state").map((f) => f.payload);

  it("first tap leaves at once; rapid taps coalesce to the latest, in order, exactly once", async () => {
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    api!.pushSnapshot(state(0, []));
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    sent.length = 0;
    api!.pushSnapshot(state(1, ["a"]));
    expect(frames()).toHaveLength(1); // leading edge: immediate
    api!.pushSnapshot(state(1, ["a", "b"]));
    api!.pushSnapshot(state(1, ["a", "b", "c"]));
    expect(frames()).toHaveLength(1);
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
    const f = frames();
    expect(f).toHaveLength(2);
    expect(f[1].patch.floating.usedOrder).toEqual(["a", "b", "c"]);
    expect(f[1].seq).toBe(f[0].seq + 1);
    vi.advanceTimersByTime(1000);
    expect(frames()).toHaveLength(2); // nothing re-sent
  });

  it("a tap does not re-serialise unchanged large ink (operation count)", async () => {
    const s0 = state(0, []);
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    api!.pushSnapshot(s0);
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    const spy = vi.spyOn(JSON, "stringify");
    api!.pushSnapshot({ ...s0, activeLineIdx: 2 }); // same freeLines reference
    const inkCalls = spy.mock.calls.filter(([v]) => v === bigInk).length;
    spy.mockRestore();
    expect(inkCalls).toBe(0);
    const last = frames().at(-1)!;
    expect(Object.keys(last.patch)).toEqual(["activeLineIdx"]);
  });

  it("ignores its own echo and applies a peer frame once", async () => {
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    api!.pushSnapshot(state(0, []));
    const own = frames().at(-1)!;
    await act(async () => handlers.get("state")!({ payload: own }));
    expect(api!.incoming).toBeNull();
    const peer = { seq: 1, epoch: "e", author: "student", ts: 1, full: true, patch: state(3, ["z"]) };
    await act(async () => handlers.get("state")!({ payload: peer }));
    const first = api!.incoming;
    expect(first?.activeLineIdx).toBe(3);
    await act(async () => handlers.get("state")!({ payload: peer })); // duplicate delivery
    expect(api!.incoming).toBe(first);
  });

  it("queues while disconnected and sends the latest state on rejoin", async () => {
    await act(async () => { opts.onStatus(false); });
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    api!.pushSnapshot(state(4, ["q"]));
    expect(frames()).toHaveLength(0);
    await act(async () => { opts.onStatus(true); opts.onJoined(); });
    const f = frames();
    expect(f.length).toBeGreaterThan(0);
    expect(f.at(-1)!.patch.activeLineIdx).toBe(4);
    expect(f.some((x) => x.full)).toBe(true);
  });

  it("sending and diagnostics do not re-render the board; a peer frame renders once", async () => {
    vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    const r0 = renders;
    for (let i = 0; i < 10; i++) {
      // one tap per task, as in the browser
      await act(async () => { api!.pushSnapshot(state(i, [String(i)])); });
      vi.advanceTimersByTime(BROADCAST_INTERVAL_MS + 1);
    }
    expect(frames().length).toBe(10);
    expect(renders - r0).toBe(0);
    expect(api!.getDiagnostics().seqSent).toBeGreaterThanOrEqual(10);
    const r1 = renders;
    await act(async () => handlers.get("state")!({ payload: { seq: 1, epoch: "p", author: "student", ts: 1, full: true, patch: state(7, ["s"]) } }));
    expect(renders - r1).toBe(1);
  });
});
