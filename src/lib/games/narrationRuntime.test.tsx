import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNarrationPlayback, type NarrationRuntime } from "./narration";
import type { Narration, Scene } from "./types";

const bus = vi.hoisted(() => ({ enqueue: vi.fn(), queue: vi.fn(), stop: vi.fn(), leave: vi.fn(), signed: vi.fn(), speaking: false }));
vi.mock("./audio", () => ({
  enqueueNarration: bus.enqueue, queueNarration: bus.queue, stopChannel: bus.stop,
  stopNarrationForStage: bus.leave, isSpeaking: () => bus.speaking,
  pauseChannel: vi.fn(), resumeChannelPlayback: vi.fn(),
}));
vi.mock("./urls", () => ({ getSignedUrl: bus.signed }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/costs/clientMeter", () => ({ bytesToGb: vi.fn(), meterClientUsage: vi.fn() }));

const point = { id: "point-one", title: "Point", elements: [], loopStart: 10, loopEnd: 20 } as unknown as Scene;
const clip = (id: string, at: number, mode: "once" | "repeat" = "repeat", source = "url") => ({ id, at, mode, source, path: `${id}.mp3` }) as Narration;
let root: Root;
let host: HTMLDivElement;
let runtime: NarrationRuntime;
function Harness({ clips }: { clips: Narration[] }) { runtime = useNarrationPlayback(clips, true, "run-one", [point]); return null; }
beforeEach(() => {
  vi.clearAllMocks(); bus.speaking = false;
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function mount(clips: Narration[]) { await act(async () => root.render(<Harness clips={clips} />)); bus.stop.mockClear(); }
async function tick(action: () => void) { await act(async () => { action(); await Promise.resolve(); }); }
const scheduled = () => [...bus.enqueue.mock.calls, ...bus.queue.mock.calls].flatMap(([items]) => items);

describe("learning-point narration lifecycle", () => {
  it("owns entry narration before time processing and schedules a Repeat clip once", async () => {
    await mount([clip("intro", 10)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); });
    expect(scheduled()).toEqual([{ src: "intro.mp3", owner: point.id }]);
    await tick(() => runtime.onStageChange(null));
    expect(bus.leave).toHaveBeenCalledWith(point.id);
  });
  it("does not schedule the same clip again when timestamp processing follows loop entry", async () => {
    await mount([clip("intro", 10)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onLoopStart(point); runtime.onTime(10); });
    expect(scheduled()).toHaveLength(1);
  });
  it("does not requeue a later Repeat clip already queued for the current lap", async () => {
    await mount([clip("explanation", 15)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); runtime.onTime(15); });
    expect(scheduled()).toHaveLength(1);
  });
  it("keeps a speaking clip intact on video wrap and permits Repeat on the next lap", async () => {
    await mount([clip("reminder", 10)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); runtime.onTime(19.8); });
    bus.speaking = true;
    await tick(() => runtime.onTime(10));
    expect(bus.stop).not.toHaveBeenCalled();
    expect(bus.leave).not.toHaveBeenCalled();
    await tick(() => runtime.onTime(10.2));
    expect(scheduled()).toHaveLength(2);
    expect(bus.queue).toHaveBeenCalledTimes(1);
  });
  it("keeps Play Once silent on later laps", async () => {
    await mount([clip("intro", 10, "once")]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); runtime.onTime(19.8); runtime.onTime(10); runtime.onTime(10.2); });
    expect(scheduled()).toHaveLength(1);
  });
  it("does not start a departed point's Repeat again while the video leaves its loop", async () => {
    await mount([clip("explanation", 15)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); runtime.onStageChange(null); runtime.onTime(15); });
    expect(scheduled()).toHaveLength(1);
    expect(bus.leave).toHaveBeenCalledWith(point.id);
  });
  it("does not interrupt narration when the same stage remains active", async () => {
    await mount([clip("intro", 10)]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onStageChange(point.id); });
    expect(bus.leave).not.toHaveBeenCalled();
  });
  it("drops a storage clip whose URL resolves after leaving its learning point", async () => {
    let resolve!: (url: string) => void;
    bus.signed.mockReturnValue(new Promise<string>(r => { resolve = r; }));
    await mount([clip("slow", 10, "once", "storage")]);
    await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onStageChange(null); });
    await tick(() => resolve("late.mp3"));
    expect(scheduled()).toHaveLength(0);
  });
});
