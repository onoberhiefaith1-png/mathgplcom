import { describe, expect, it, vi } from "vitest";
import { runDuplicateRequest } from "../duplicateRequests";

describe("duplicate request identity", () => {
  it("coalesces concurrent clicks into one server operation", async () => {
    let finish!: (id: string) => void;
    const send = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const first = runDuplicateRequest("concurrent", () => "request-1", send);
    const second = runDuplicateRequest("concurrent", () => "request-2", send);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
    finish("copy-1");
    expect(await first).toBe("copy-1");
  });
  it("reuses the token after an uncertain failure, even from another menu", async () => {
    const makeId = vi.fn(() => "same-request");
    const failed = vi.fn().mockRejectedValue(new Error("network interrupted"));
    await expect(runDuplicateRequest("retry", makeId, failed)).rejects.toThrow("network interrupted");
    const retry = vi.fn().mockResolvedValue("first committed copy");
    expect(await runDuplicateRequest("retry", makeId, retry)).toBe("first committed copy");
    expect(makeId).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith("same-request");
    expect(retry).toHaveBeenCalledWith("same-request");
  });
  it("allows a deliberate new copy after success", async () => {
    let n = 0;
    const send = vi.fn(async (id: string) => id);
    expect(await runDuplicateRequest("new intent", () => `request-${++n}`, send)).toBe("request-1");
    expect(await runDuplicateRequest("new intent", () => `request-${++n}`, send)).toBe("request-2");
  });
  it("isolates accounts looking at the same source item", async () => {
    const send = vi.fn(async (id: string) => id);
    const values = await Promise.all([
      runDuplicateRequest("teacher-A:subject:same-id", () => "A", send),
      runDuplicateRequest("teacher-B:subject:same-id", () => "B", send),
    ]);
    expect(values).toEqual(["A", "B"]);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("isolates different hierarchy levels and sources", async () => {
    const send = vi.fn(async (id: string) => id);
    expect(await Promise.all([
      runDuplicateRequest("A:topic:1", () => "one", send),
      runDuplicateRequest("A:session:1", () => "two", send),
      runDuplicateRequest("A:topic:2", () => "three", send),
    ])).toEqual(["one", "two", "three"]);
  });
  it("releases a synchronously failed transport for the same-token retry", async () => {
    await expect(runDuplicateRequest("sync failure", () => "token", () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(await runDuplicateRequest("sync failure", () => "wrong-token", async id => id)).toBe("token");
  });
});
