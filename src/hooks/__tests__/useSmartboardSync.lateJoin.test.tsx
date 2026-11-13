// A student who opens the class mid-lesson: the hook (mounted, fake channel and
// saved row) must show the teacher's board as soon as the lesson is ready here,
// adopt the teacher's Preview plan, and route snapshot requests to the holder.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

let row: unknown = null;
const httpSends: Array<{ event: string; payload: any }> = [];
vi.mock("@/integrations/supabase/client", () => {
  const q: any = {
    select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: row ? { state_json: row, active_student_id: null } : null, error: null }),
    upsert: async () => ({ error: null }),
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "student" } } }) },
      from: () => q,
      channel: () => ({ httpSend: async (event: string, payload: unknown) => { httpSends.push({ event, payload }); return { success: true }; } }),
      removeChannel: async () => "ok",
    },
  };
});
vi.mock("@/lib/stability/usePolling", () => ({ usePolling: () => undefined }));
const channels = new Map<string, any>();
vi.mock("@/lib/stability/useLiveChannel", () => ({ useLiveChannel: (o: any) => { channels.set(String(o.key).split("-")[0]!, o); } }));

const { setupDom } = await import("@/test/domRender");
const { useSmartboardSync } = await import("@/hooks/useSmartboardSync");
type BoardState = import("@/hooks/useSmartboardSync").BoardState;

const teacherBoard = (over: Partial<BoardState> = {}): BoardState => ({
  beatCursor: 4, bandExtra: {}, freeLines: { 3: "ink" }, lineOffsets: {}, smartLines: [], boxes: [],
  sensor: { line: 3, x: 9 }, zoom: 1, surface: "whiteboard", profileId: "p", inkColorId: "i",
  sourceNotebookId: "nb", sourceFingerprint: "fp-with-plan", planSkipped: ["b2"], activeLineIdx: 2, lineEngaged: true, floating: null, ...over,
});

let api: ReturnType<typeof useSmartboardSync> | null = null;
const plans: string[][] = [];
function Probe({ fp }: { fp: string }) {
  api = useSmartboardSync({ classId: "c1", notebookId: "nb", sourceFingerprint: fp, role: "student", onRemotePlan: (_nb, skipped) => plans.push(skipped) });
  return null;
}

describe("useSmartboardSync: student joining mid-lesson", () => {
  let dom: ReturnType<typeof setupDom>;
  let handlers: Map<string, (m: { payload: unknown }) => void>;
  const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
  beforeEach(async () => {
    row = null; httpSends.length = 0; plans.length = 0; channels.clear();
    dom = setupDom();
    handlers = new Map();
  });
  afterEach(async () => { await dom.cleanup(); });
  const join = async () => {
    const o = channels.get("sb")!;
    const ch: any = { on: (_t: string, f: { event: string }, h: any) => { handlers.set(f.event, h); return ch; }, send: () => Promise.resolve("ok") };
    o.build(ch);
    await act(async () => { o.onStatus(true); o.onJoined(); });
    await flush();
  };

  it("shows the saved board straight away, even with the lesson still loading, once it matches", async () => {
    row = { v: 1, author: "teacher", ts: Date.now(), ...teacherBoard(), syncEpoch: "e1", syncEpochAt: 1, syncSeq: 40, syncHash: "x", syncAudience: 25 };
    await dom.render(<Probe fp="loading" />);
    await flush();
    await join();
    expect(api!.incoming).toBeNull(); // not this lesson yet here
    expect(plans.at(-1)).toEqual(["b2"]); // but the teacher's plan is handed over
    await dom.render(<Probe fp="fp-with-plan" />); // plan applied → same lesson shape
    await flush();
    expect(api!.incoming?.beatCursor).toBe(4);
    expect(api!.incoming?.freeLines).toEqual({ 3: "ink" });
  });

  it("a live full board that arrives before the lesson loads is not lost", async () => {
    await dom.render(<Probe fp="loading" />);
    await flush();
    await join();
    await act(async () => handlers.get("state")!({ payload: { seq: 7, base: 6, epoch: "e9", epochAt: 5, author: "teacher", ts: 1, full: true, patch: teacherBoard({ zoom: 2 }) } }));
    expect(api!.incoming).toBeNull();
    await dom.render(<Probe fp="fp-with-plan" />);
    await flush();
    expect(api!.incoming?.zoom).toBe(2);
  });

  it("asks the board holder directly once it has heard its heartbeat", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      await dom.render(<Probe fp="fp-with-plan" />);
      await flush();
      await join();
      await act(async () => handlers.get("state")!({ payload: { seq: 1, base: 0, epoch: "e1", epochAt: 5, author: "teacher", ts: 1, full: true, patch: teacherBoard() } }));
      // the teacher is now at seq 9 and listens for requests
      await act(async () => handlers.get("beat")!({ payload: { author: "teacher", epoch: "e1", epochAt: 5, seq: 9, hash: "h", ts: 2, aud: 25, rq: true } }));
      await act(async () => { vi.advanceTimersByTime(1000); });
      await flush();
      expect(httpSends.some((m) => m.event === "want" && m.payload.to === "teacher")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
