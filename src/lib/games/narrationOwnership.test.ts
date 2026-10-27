import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let created: FakeAudio[];
class FakeAudio {
  src = ""; volume = 1; loop = false; paused = true; ended = false; currentTime = 0; muted = false; preload = "";
  onended: (() => void) | null = null;
  constructor() { created.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); created = [];
  vi.stubGlobal("window", { setInterval, clearInterval }); vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function load() { const audio = await import("./audio"); audio.unlockAudio(); return audio; }

describe("departed learning point audio", () => {
  it("stops its speaking clip and removes all its queued clips", async () => {
    const a = await load();
    a.enqueueNarration([{ src: "one.mp3", owner: "point" }, { src: "two.mp3", owner: "point" }]);
    a.stopNarrationForStage("point"); vi.advanceTimersByTime(160);
    expect(created[0].paused).toBe(true); expect(created[0].onended).toBeNull(); expect(a.narrationOwner()).toBeUndefined();
  });
  it("removes a departed stage's queued clips while preserving plain-timeline narration", async () => {
    const a = await load();
    a.enqueueNarration([{ src: "outside.mp3", owner: null }, { src: "departed.mp3", owner: "point" }, { src: "next.mp3", owner: "next-point" }]);
    a.stopNarrationForStage("point");
    expect(created[0].src).toBe("outside.mp3"); expect(created[0].paused).toBe(false);
    created[0].onended?.(); expect(created[0].src).toBe("next.mp3");
  });
  it("preserves another stage's queued clip when the speaking stage is stopped", async () => {
    const a = await load();
    a.enqueueNarration([{ src: "old.mp3", owner: "point" }, { src: "next.mp3", owner: "next-point" }]);
    a.stopNarrationForStage("point"); vi.advanceTimersByTime(160);
    expect(created[0].src).toBe("next.mp3"); expect(created[0].paused).toBe(false); expect(a.narrationOwner()).toBe("next-point");
  });
});

it("a hard narration boundary pauses immediately and broadcasts that background sound can return", async () => {
 const audio=await load(); const states:boolean[]=[]; const unsub=audio.subscribeNarrationActivity(v=>states.push(v));
 audio.setChannelVolume("narration",0.7);
 audio.enqueueNarration([{id:"voice",src:"voice.mp3",owner:"loop"}]); await Promise.resolve();
 expect(created[0].volume).toBe(0.7); expect(states).toContain(true);
 audio.stopChannel("narration",0);
 expect(created[0].paused).toBe(true); expect(audio.narrationScheduled("voice")).toBe(false);
 expect(states.at(-1)).toBe(false); unsub();
});
it("natural once-clip completion restores the live narration state without waiting for video time", async () => {
 const audio=await load(); const states:boolean[]=[]; const unsub=audio.subscribeNarrationActivity(v=>states.push(v));
 audio.enqueueNarration([{id:"once",src:"once.mp3"}]); await Promise.resolve();
 created[0].paused=true; created[0].ended=true; created[0].onended?.();
 expect(states.at(-1)).toBe(false); expect(audio.narrationScheduled("once")).toBe(false); unsub();
});
