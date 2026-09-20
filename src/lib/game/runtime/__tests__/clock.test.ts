import { describe, expect, it, vi } from "vitest";
import { gameClockListenerCount, secondsUntil, subscribeGameClock } from "../clock";

describe("the one game clock", () => {
  it("drives every subscriber from a single interval", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(window, "setInterval");
    const a = vi.fn();
    const b = vi.fn();
    const stopA = subscribeGameClock(a);
    const stopB = subscribeGameClock(b);
    expect(gameClockListenerCount()).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();

    stopA();
    stopB();
    expect(gameClockListenerCount()).toBe(0);
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("never reports negative time and treats no deadline as finished", () => {
    expect(secondsUntil(null)).toBe(0);
    expect(secondsUntil(1_000, 5_000)).toBe(0);
    expect(secondsUntil(10_000, 5_000)).toBe(5);
  });
});
