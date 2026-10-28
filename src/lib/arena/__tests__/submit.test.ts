import { describe, it, expect, vi } from "vitest";
import {
  ArenaApiError,
  COMPLETE_BACKOFF_MS,
  START_BACKOFF_MS,
  dropOutbox,
  enqueueOutbox,
  isDefinitiveError,
  readOutbox,
  recordCompletion,
  recordStart,
  type SubmitEvent,
} from "@/lib/arena/submit";

const args = {
  code: "TAABCDEFGH",
  token: "t-1",
  assessmentId: "as-1",
  questionId: "q-1",
  elapsedMs: 8200,
};
const mk = (replies: Array<Record<string, unknown> | Error>) => {
  const events: SubmitEvent[] = [];
  const sleeps: number[] = [];
  let i = 0;
  const post = vi.fn(async (_code: string, _body: Record<string, unknown>) => {
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    return r;
  });
  return {
    deps: {
      post,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      emit: (e: SubmitEvent) => events.push(e),
    },
    events,
    sleeps,
    post,
  };
};

describe("recording a finished question", () => {
  it("sends the complete action and reports a saved, counted time", async () => {
    const t = mk([{ ok: true, counted: true, newBest: true, ms: 8100 }]);
    const r = await recordCompletion(t.deps, args);
    expect(t.post).toHaveBeenCalledWith("TAABCDEFGH", {
      action: "complete",
      token: "t-1",
      assessmentId: "as-1",
      questionId: "q-1",
      elapsedMs: 8200,
    });
    expect(r).toMatchObject({
      state: "saved",
      counted: true,
      newBest: true,
      ms: 8100,
    });
    expect(t.events.map((e) => e.state)).toEqual(["sending", "saved"]);
  });

  it("keeps waiting while marking lands, then saves (the old code gave up after ~7s)", async () => {
    const t = mk([
      { pending: true },
      { pending: true },
      { pending: true },
      { pending: true },
      { pending: true },
      { ok: true, counted: true, newBest: false, ms: 9000 },
    ]);
    const r = await recordCompletion(t.deps, args);
    expect(r.state).toBe("saved");
    expect(t.post).toHaveBeenCalledTimes(6);
    expect(t.events.some((e) => e.state === "waiting")).toBe(true);
    expect(t.sleeps).toEqual(COMPLETE_BACKOFF_MS.slice(0, 5));
  });

  it("retries a dropped connection and still saves", async () => {
    const t = mk([
      new TypeError("Failed to fetch"),
      new ArenaApiError("failed", 503),
      { ok: true, counted: true, newBest: true, ms: 7000 },
    ]);
    const r = await recordCompletion(t.deps, args);
    expect(r).toMatchObject({ state: "saved", counted: true });
    expect(t.post).toHaveBeenCalledTimes(3);
  });

  it("surfaces a retryable failure (not silence) when the server never confirms", async () => {
    const t = mk([{ pending: true }]);
    const r = await recordCompletion(t.deps, args);
    expect(r).toMatchObject({ state: "failed", retryable: true });
    expect(r.message).toMatch(/Retry/);
    expect(t.post).toHaveBeenCalledTimes(COMPLETE_BACKOFF_MS.length + 1);
  });

  it("surfaces a retryable failure when offline the whole time", async () => {
    const t = mk([new TypeError("Failed to fetch")]);
    const r = await recordCompletion(t.deps, args);
    expect(r).toMatchObject({ state: "failed", retryable: true });
    expect(r.message).toMatch(/connection/i);
  });

  it("stops at once, with a clear reason, when the group is closed", async () => {
    const t = mk([new ArenaApiError("closed", 403)]);
    const r = await recordCompletion(t.deps, args);
    expect(r).toMatchObject({ state: "failed", retryable: false });
    expect(r.message).toMatch(/closed/i);
    expect(t.post).toHaveBeenCalledTimes(1);
  });

  it("explains a student who never joined, without retrying", async () => {
    const t = mk([new ArenaApiError("not_joined", 403)]);
    const r = await recordCompletion(t.deps, args);
    expect(r.retryable).toBe(false);
    expect(r.message).toMatch(/joined/i);
    expect(t.post).toHaveBeenCalledTimes(1);
  });

  it("a counted:false answer (time rejected) is final, not an error", async () => {
    const t = mk([{ ok: true, counted: false }]);
    const r = await recordCompletion(t.deps, args);
    expect(r).toMatchObject({ state: "saved", counted: false });
  });
});

describe("recording the start", () => {
  it("retries quietly so one lost request can't lose the attempt's start", async () => {
    const t = mk([new TypeError("offline"), { ok: true }]);
    expect(await recordStart(t.deps, args)).toBe(true);
    expect(t.post).toHaveBeenCalledTimes(2);
    expect(t.sleeps).toEqual([START_BACKOFF_MS[0]]);
  });
  it("gives up after its retries and on a definitive refusal", async () => {
    const lost = mk([new TypeError("offline")]);
    expect(await recordStart(lost.deps, args)).toBe(false);
    expect(lost.post).toHaveBeenCalledTimes(START_BACKOFF_MS.length + 1);
    const closed = mk([new ArenaApiError("closed", 403)]);
    expect(await recordStart(closed.deps, args)).toBe(false);
    expect(closed.post).toHaveBeenCalledTimes(1);
  });
});

describe("error classification", () => {
  it("only server verdicts are final; network and 5xx are retried", () => {
    expect(isDefinitiveError(new ArenaApiError("closed", 403))).toBe(true);
    expect(isDefinitiveError(new ArenaApiError("whatever", 404))).toBe(true);
    expect(isDefinitiveError(new ArenaApiError("failed", 500))).toBe(false);
    expect(isDefinitiveError(new ArenaApiError("failed", 429))).toBe(false);
    expect(isDefinitiveError(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("outbox", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };
  it("queues one pending result per question and drops it once answered", () => {
    const s = mem();
    const t = Date.now();
    enqueueOutbox(s, args, t - 2000);
    enqueueOutbox(s, { ...args, elapsedMs: 7000 }, t - 1000);
    enqueueOutbox(s, { ...args, assessmentId: "as-2" }, t - 1000);
    expect(readOutbox(s, t).map((x) => [x.assessmentId, x.elapsedMs])).toEqual([
      ["as-1", 7000],
      ["as-2", 8200],
    ]);
    // An acknowledgement for the previous attempt must not delete its faster successor.
    dropOutbox(s, args);
    expect(readOutbox(s, t).map((x) => x.assessmentId)).toEqual(["as-1", "as-2"]);
    dropOutbox(s, { ...args, elapsedMs: 7000 });
    expect(readOutbox(s, t).map((x) => x.assessmentId)).toEqual(["as-2"]);
  });
  it("expires old entries and survives corrupt storage", () => {
    const s = mem();
    enqueueOutbox(s, args, 1000);
    expect(readOutbox(s, 1000 + 7 * 60 * 60 * 1000)).toEqual([]);
    s.setItem("mathgpl.arena.outbox.v1", "{not json");
    expect(readOutbox(s)).toEqual([]);
  });
});

it("keeps MCQ answer and Adventure working evidence through completion retries",async()=>{
 const {recordCompletion}=await import("../submit");const sent:Record<string,unknown>[]=[];
 await recordCompletion({post:async(_code,body)=>{sent.push(body);return {ok:true,counted:true};},sleep:async()=>{},emit:()=>{}},{code:"TAexample",token:"t",assessmentId:"a",questionId:"q",elapsedMs:1000,answer:"B",working:{line:"x=5"}});
 expect(sent[0]).toMatchObject({answer:"B",working:{line:"x=5"},elapsedMs:1000});
});
