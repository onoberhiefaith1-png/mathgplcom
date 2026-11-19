import { afterEach, describe, expect, it, vi } from "vitest";
import { afterLessonActionPaint, loadLessonAction, syncLessonActionDocument } from "../lessonAction";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("lesson action loading", () => {
  it("defers work until after the next frame and cancels closed actions", () => {
    vi.useFakeTimers();
    const frame: { callback?: FrameRequestCallback } = {};
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame.callback = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const work = vi.fn();
    afterLessonActionPaint(work);
    expect(work).not.toHaveBeenCalled();
    frame.callback?.(0);
    expect(work).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledOnce();

    const closed = vi.fn();
    const cancel = afterLessonActionPaint(closed);
    frame.callback?.(0);
    cancel();
    vi.runAllTimers();
    expect(closed).not.toHaveBeenCalled();
  });

  it("shows an offline state without starting network work", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const request = vi.fn();
    await expect(loadLessonAction(request, new AbortController().signal)).rejects.toThrow("offline");
    expect(request).not.toHaveBeenCalled();
  });

  it("bounds an unanswered request and aborts it", async () => {
    const work = vi.fn((signal: AbortSignal) => new Promise<void>(() => {
      expect(signal.aborted).toBe(false);
    }));
    await expect(loadLessonAction(work, new AbortController().signal, 1)).rejects.toThrow("too long");
    expect(work.mock.calls[0][0].aborted).toBe(true);
  });

  it("shares a sync for the same editor document and releases it after completion", async () => {
    const document = {};
    const sync = vi.fn(async () => undefined);
    const first = syncLessonActionDocument(document, sync);
    expect(syncLessonActionDocument(document, sync)).toBe(first);
    await first;
    expect(sync).toHaveBeenCalledOnce();
    await syncLessonActionDocument(document, sync);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
