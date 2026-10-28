// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeArena,
  arenaComplete,
  arenaStart,
  flushArenaOutbox,
  setActiveArena,
} from "@/lib/arena/arenaClient";
import { readOutbox, type SubmitEvent } from "@/lib/arena/submit";

type Reply = { status?: number; body: Record<string, unknown> } | "offline";
let replies: Reply[] = [];
let calls: Array<{ url: string; body: Record<string, unknown> }> = [];
let events: SubmitEvent[] = [];
const onSubmit = (e: Event) => events.push((e as CustomEvent).detail);

const settle = async (until: () => boolean) => {
  for (let i = 0; i < 200 && !until(); i++)
    await vi.advanceTimersByTimeAsync(500);
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  replies = [];
  calls = [];
  events = [];
  setActiveArena("GUEST1", "TAABCDEFGH");
  window.addEventListener("arena:submit", onSubmit);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : {},
      });
      const r = replies.length > 1 ? replies.shift()! : replies[0]!;
      if (r === "offline") throw new TypeError("Failed to fetch");
      return {
        ok: (r.status ?? 200) < 400,
        status: r.status ?? 200,
        json: async () => r.body,
      } as Response;
    }),
  );
});
afterEach(() => {
  window.removeEventListener("arena:submit", onSubmit);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("student attempt → Arena (mocked server)", () => {
  it("does nothing when this Session isn't an Arena", () => {
    localStorage.clear();
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 5000);
    expect(calls).toHaveLength(0);
    expect(activeArena("GUEST1")).toBeNull();
  });

  it("posts the start, then the complete with the device's claimed time, and clears the outbox when saved", async () => {
    replies = [{ body: { ok: true, counted: true, newBest: true, ms: 7400 } }];
    arenaStart("GUEST1", "tok", "as-1", "q-1");
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 7500);
    await settle(() => events.some((e) => e.state === "saved"));
    expect(calls.map((c) => c.body.action)).toEqual(["start", "complete"]);
    expect(calls[1]!.body).toMatchObject({
      token: "tok",
      assessmentId: "as-1",
      questionId: "q-1",
      elapsedMs: 7500,
    });
    expect(events.at(-1)).toMatchObject({
      state: "saved",
      counted: true,
      newBest: true,
      ms: 7400,
    });
    expect(readOutbox(localStorage)).toEqual([]);
  });

  it("the old failure mode: a closed network leaves a visible failure and keeps the time queued for Retry", async () => {
    replies = ["offline"];
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 7500);
    await settle(() => events.some((e) => e.state === "failed"));
    expect(events.at(-1)).toMatchObject({ state: "failed", retryable: true });
    expect(readOutbox(localStorage)).toHaveLength(1);

    // Connection returns; the student taps Retry (or the heartbeat flushes the outbox).
    replies = [{ body: { ok: true, counted: true, newBest: true, ms: 7400 } }];
    const done = flushArenaOutbox("as-1");
    await settle(() => events.at(-1)?.state === "saved");
    await done;
    expect(events.at(-1)).toMatchObject({ state: "saved", counted: true });
    expect(readOutbox(localStorage)).toEqual([]);
  });

  it("a 403 closed answer fails once, with no retry storm, and does not stay queued", async () => {
    replies = [{ status: 403, body: { error: "closed" } }];
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 7500);
    await settle(() => events.some((e) => e.state === "failed"));
    expect(calls.filter((c) => c.body.action === "complete")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ state: "failed", retryable: false });
    expect(readOutbox(localStorage)).toEqual([]);
  });

  it("waits through 'pending' (marking not written yet) instead of dropping the attempt", async () => {
    replies = [
      { body: { pending: true } },
      { body: { pending: true } },
      { body: { ok: true, counted: true, newBest: true, ms: 9100 } },
    ];
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 9200);
    await settle(() => events.some((e) => e.state === "saved"));
    expect(calls).toHaveLength(3);
    expect(events.some((e) => e.state === "waiting")).toBe(true);
  });

  it("never double-sends the same question when the heartbeat flushes during a send", async () => {
    replies = [
      { body: { pending: true } },
      { body: { ok: true, counted: true, newBest: true, ms: 9100 } },
    ];
    arenaComplete("GUEST1", "tok", "as-1", "q-1", 9200);
    void flushArenaOutbox();
    await settle(() => events.some((e) => e.state === "saved"));
    expect(calls).toHaveLength(2);
  });
});
