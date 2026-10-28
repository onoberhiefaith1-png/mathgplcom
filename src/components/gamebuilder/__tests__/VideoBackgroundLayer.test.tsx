/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VideoBackgroundLayer from "../VideoBackgroundLayer";

vi.mock("../SignedMedia", () => ({ useSignedUrl: () => null }));

let root: Root; let host: HTMLElement; let raf: (() => void) | null;
let sets: number[]; let plays: number; let pauses: number;
const video = { path: "/movie.mp4", source: "url" } as any;

function mount(props: Record<string, unknown> = {}) {
  act(() => root.render(<VideoBackgroundLayer video={video} {...props} />));
  const el = host.querySelector("video") as HTMLVideoElement;
  let time = 0, seeking = false, ready = 0, paused = true;
  Object.defineProperty(el, "currentTime", { get: () => time, set: (v) => { time = v; sets.push(v); }, configurable: true });
  Object.defineProperty(el, "seeking", { get: () => seeking, configurable: true });
  Object.defineProperty(el, "readyState", { get: () => ready, configurable: true });
  Object.defineProperty(el, "paused", { get: () => paused, configurable: true });
  el.play = () => { plays += 1; paused = false; return Promise.resolve(); };
  el.pause = () => { pauses += 1; paused = true; };
  return { el, setTime: (t: number) => { time = t; }, setReady: (n: number) => { ready = n; }, setSeeking: (b: boolean) => { seeking = b; } };
}

beforeEach(() => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/academia-app", pretendToBeVisual: true });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  raf = null; sets = []; plays = 0; pauses = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { raf = cb; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => { raf = null; });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
const frame = () => { const f = raf; raf = null; act(() => f?.()); };

it("asks the browser to buffer ahead and plays inline", () => {
  const { el } = mount();
  expect(el.getAttribute("preload")).toBe("auto");
  expect(el.hasAttribute("playsinline") || (el as any).playsInline).toBeTruthy();
});

it("reports ready on canplaythrough, not on loadedmetadata", () => {
  const onReady = vi.fn();
  const { el } = mount({ onReady });
  act(() => { el.dispatchEvent(new (window as any).Event("loadedmetadata")); });
  expect(onReady).not.toHaveBeenCalled();
  act(() => { el.dispatchEvent(new (window as any).Event("canplaythrough")); });
  expect(onReady).toHaveBeenCalledTimes(1);
});

it("does not call play() before the video can play on; plays the moment it can", () => {
  const h = mount({ playing: true });
  expect(plays).toBe(0);
  h.setReady(3);
  act(() => { h.el.dispatchEvent(new (window as any).Event("canplay")); });
  expect(plays).toBe(1);
});

it("wraps the loop once, at the end, and never seeks twice for one crossing", () => {
  const h = mount({ playing: true, loop: { start: 10, end: 20 } });
  h.setReady(4); h.setTime(12);
  act(() => { vi.advanceTimersByTime(1000); }); // past the snap-in seek made at mount
  sets = []; frame();
  expect(sets).toEqual([]);
  h.setTime(20.02); frame();
  expect(sets).toEqual([10]);
  // The seek has landed at 10: further frames inside the region add nothing.
  frame(); frame();
  expect(sets).toEqual([10]);
  // Still reading past the end for a moment (seek in flight): no second seek.
  act(() => { vi.advanceTimersByTime(1000); });
  h.setTime(20.1); h.setSeeking(true); frame();
  expect(sets).toEqual([10]);
});

it("does not seek when the loop region switches on and the playhead is already inside it", () => {
  const h = mount({ playing: true });
  h.setTime(12);
  act(() => root.render(<VideoBackgroundLayer video={video} playing loop={{ start: 10, end: 20 }} />));
  expect(sets).toEqual([]);
  act(() => root.render(<VideoBackgroundLayer video={video} playing loop={{ start: 40, end: 50 }} />));
  expect(sets).toEqual([40]);
});

it("re-rendering with a new but equal loop object does not seek again", () => {
  const h = mount({ playing: true, loop: { start: 10, end: 20 } });
  h.setTime(15);
  for (let i = 0; i < 5; i++) act(() => root.render(<VideoBackgroundLayer video={video} playing loop={{ start: 10, end: 20 }} />));
  expect(sets).toEqual([]);
});

it("recovers a stalled picture: pauses after a few seconds of waiting, plays again when data arrives", () => {
  const onBuffering = vi.fn();
  const h = mount({ playing: true, onBuffering });
  h.setReady(4);
  act(() => { h.el.dispatchEvent(new (window as any).Event("canplay")); });
  const playsBefore = plays;
  h.setReady(2);
  act(() => { h.el.dispatchEvent(new (window as any).Event("waiting")); });
  expect(onBuffering).toHaveBeenLastCalledWith(true);
  act(() => { vi.advanceTimersByTime(3500); });
  expect(pauses).toBeGreaterThanOrEqual(1);
  h.setReady(4);
  act(() => { h.el.dispatchEvent(new (window as any).Event("canplay")); });
  expect(plays).toBeGreaterThan(playsBefore);
  expect(onBuffering).toHaveBeenLastCalledWith(false);
});

it("keeps one <video> element across re-renders (no remount)", () => {
  const h = mount({ playing: true });
  act(() => root.render(<VideoBackgroundLayer video={video} playing={false} loop={{ start: 1, end: 2 }} />));
  act(() => root.render(<VideoBackgroundLayer video={video} playing loop={null} />));
  expect(host.querySelector("video")).toBe(h.el);
});
