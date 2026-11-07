import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PreClearedLines, requestPreClearance } from "../preClear";

const deferred = <T,>() => {
  let res!: (v: T) => void; let rej!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => { res = a; rej = b; });
  return { promise, res, rej };
};

describe("pre-clearance requests feed immediate grading", () => {
  it("grades the first line when its answer arrives after the student already finished it", async () => {
    const store = new PreClearedLines();
    const board = { text: "x + 7" }; // student still typing when the ask goes out
    const pending = deferred<string[]>();
    const awarded: string[] = [];
    const run = requestPreClearance({
      store, slotKey: "q1:l1", candidates: ["x + 7 = 12"],
      send: () => pending.promise,
      isCurrent: () => true,
      onAccepted: () => { if (store.isCleared("q1:l1", board.text)) awarded.push(board.text); },
    });
    board.text = "x + 7 = 12"; // finishing keystroke lands while the ask is pending
    expect(store.isCleared("q1:l1", board.text)).toBe(false);
    pending.res(["x + 7 = 12"]);
    await expect(run).resolves.toBe("accepted");
    expect(awarded).toEqual(["x + 7 = 12"]);
  });

  it("releases a failed ask so continued typing retries it", async () => {
    const store = new PreClearedLines();
    const send = vi.fn().mockRejectedValueOnce(new Error("aborted")).mockResolvedValueOnce(["y = 2"]);
    const onAccepted = vi.fn();
    const args = { store, slotKey: "q:l", candidates: ["y = 2"], send, isCurrent: () => true, onAccepted };
    await expect(requestPreClearance(args)).resolves.toBe("failed");
    expect(store.unasked("q:l", ["y = 2"])).toEqual(["y = 2"]);
    await expect(requestPreClearance(args)).resolves.toBe("accepted");
    expect(send).toHaveBeenCalledTimes(2);
    expect(onAccepted).toHaveBeenCalledTimes(1);
    await expect(requestPreClearance(args)).resolves.toBe("skipped");
  });

  it("a stale answer for a question the student left grades nothing on the new question", async () => {
    const store = new PreClearedLines();
    let current = "q1";
    const pending = deferred<string[]>();
    const onAccepted = vi.fn();
    const run = requestPreClearance({
      store, slotKey: "q1:l1", candidates: ["a = 2"], send: () => pending.promise,
      isCurrent: () => current === "q1", onAccepted,
    });
    current = "q2";
    pending.res(["a = 2"]);
    await expect(run).resolves.toBe("stale");
    expect(onAccepted).not.toHaveBeenCalled();
    expect(store.isCleared("q2:l1", "a = 2")).toBe(false);
  });
});

describe("PresentationView wiring", () => {
  const src = readFileSync(resolve(__dirname, "../../../components/smartboard/PresentationView.tsx"), "utf8");
  it("routes every pre-clearance ask through requestPreClearance", () => {
    expect(src.match(/requestPreClearance\(\{/g)?.length).toBe(2);
    expect(src).not.toMatch(/preClearedRef\.current\.markAsked\(/);
  });
  it("grades through the latest award check, not a captured closure", () => {
    expect(src).toMatch(/onAccepted: \(\) => gradeSlotNow\(questionId, lineId\)/);
    expect(src).toMatch(/awardIfPredictivelyCompleteRef\.current = awardIfPredictivelyComplete/);
  });
});
