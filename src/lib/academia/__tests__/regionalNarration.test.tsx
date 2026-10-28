import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { useRegionalNarration, voiceRegionAt } from "../regionalNarration";
import type { Narration, Scene } from "@/lib/games/types";
const bus = vi.hoisted(() => ({ enqueue: vi.fn(), queue: vi.fn(), stop: vi.fn(), signed: vi.fn(), speaking: false, scheduled: new Set<string>() }));
vi.mock("@/lib/games/audio", () => ({
 enqueueNarration: bus.enqueue, queueNarration: bus.queue, stopChannel: bus.stop,
 isSpeaking: () => bus.speaking, narrationScheduled: (id: string) => bus.scheduled.has(id),
 pauseChannel: vi.fn(), resumeChannelPlayback: vi.fn(), subscribeNarrationActivity: () => () => {},
}));
vi.mock("@/lib/games/urls", () => ({ getSignedUrl: bus.signed }));
const point = { id: "loop", loopStart: 10, loopEnd: 20, elements: [] } as unknown as Scene;
const clip = (id: string, at: number, mode: "once" | "repeat" = "once", source = "url") => ({ id, at, mode, source, path: id + ".mp3" }) as Narration;
let root: Root; let host: HTMLElement; let runtime: ReturnType<typeof useRegionalNarration>;
function Harness({ clips, enabled = true }: { clips: Narration[]; enabled?: boolean }) { runtime = useRegionalNarration(clips, enabled, "run", [point]); return null; }
beforeEach(() => {
 vi.clearAllMocks(); bus.speaking = false; bus.scheduled.clear();
 bus.stop.mockImplementation(() => { bus.speaking = false; bus.scheduled.clear(); });
 const schedule = (items: {id: string}[]) => { for (const item of items) bus.scheduled.add(item.id); bus.speaking = true; };
 bus.enqueue.mockImplementation(schedule); bus.queue.mockImplementation(schedule);
 const dom = new JSDOM("<!doctype html><body></body>");
 for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
 host = document.createElement("div"); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
async function mount(clips: Narration[]) { await act(async () => root.render(<Harness clips={clips} />)); bus.stop.mockClear(); }
async function tick(fn: () => void) { await act(async () => { fn(); await Promise.resolve(); }); }
const items = () => [...bus.enqueue.mock.calls, ...bus.queue.mock.calls].flatMap(([batch]) => batch);
describe("hard narration region boundaries", () => {
 it("stops plain narration exactly on entering an empty-question loop and starts the loop voice", async () => {
  await mount([clip("outside", 0), clip("inside", 10)]);
  await tick(() => runtime.onTime(0)); expect(items().map(x => x.id)).toEqual(["outside"]);
  bus.stop.mockClear(); await tick(() => runtime.onTime(9.999)); expect(bus.stop).not.toHaveBeenCalled();
  await tick(() => runtime.onTime(10)); expect(bus.stop).toHaveBeenCalledWith("narration", 0);
  expect(items().map(x => x.id)).toEqual(["outside", "inside"]);
 });
 it("stops loop narration on the end boundary even when no question was attached", async () => {
  await mount([clip("inside", 10), clip("after", 20)]);
  await tick(() => runtime.onTime(10)); bus.stop.mockClear();
  await tick(() => runtime.onTime(20)); expect(bus.stop).toHaveBeenCalledWith("narration", 0);
  expect(items().map(x => x.id)).toEqual(["inside", "after"]);
 });
 it("keeps a two-minute clip across many ten-second laps without interrupting or queueing copies", async () => {
  await mount([clip("long", 10, "repeat")]);
  await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); });
  bus.stop.mockClear();
  for (let i=0;i<12;i++) await tick(() => { runtime.onTime(19.9); runtime.onTime(10); runtime.onTime(10.1); });
  expect(bus.stop).not.toHaveBeenCalled(); expect(items()).toHaveLength(1);
 });
 it("do not repeat remains silent after the clip completes across later laps and repeated activation", async () => {
  await mount([clip("once", 10)]);
  await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); });
  bus.scheduled.clear(); bus.speaking = false;
  for (let i=0;i<4;i++) await tick(() => { runtime.onTime(19.9); runtime.onTime(10); runtime.onTime(10.1); runtime.onLoopStart(point); });
  expect(items()).toHaveLength(1);
 });
 it("repeat can play again only after the earlier clip ends and a later lap reaches it", async () => {
  await mount([clip("repeat", 10, "repeat")]);
  await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); });
  bus.scheduled.clear(); bus.speaking=false;
  await tick(() => { runtime.onTime(19.9); runtime.onTime(10); runtime.onTime(10.1); });
  expect(items()).toHaveLength(2);
 });
 it("passing the point immediately cuts it and never restarts it while the final video lap plays out", async () => {
  await mount([clip("old", 15, "repeat"), clip("next",20)]);
  await tick(() => { runtime.onStageChange(point.id); runtime.onTime(10); runtime.onLoopStart(point); });
  bus.stop.mockClear(); await tick(() => runtime.onStageChange(null));
  expect(bus.stop).toHaveBeenCalledWith("narration",0);
  await tick(() => runtime.onTime(15)); expect(items().filter(x=>x.id==="old")).toHaveLength(1);
  await tick(() => runtime.onTime(20)); expect(items().map(x=>x.id)).toContain("next");
 });
 it("discards delayed outside narration after crossing into the loop", async () => {
  let resolve!: (url:string)=>void; bus.signed.mockReturnValue(new Promise<string>(r=>resolve=r));
  await mount([clip("late",0,"once","storage"),clip("inside",10)]);
  await tick(() => runtime.onTime(0)); await tick(() => runtime.onTime(10)); await tick(() => resolve("late.mp3"));
  expect(items().map(x=>x.id)).toEqual(["inside"]);
 });
 it("reset starts a fresh run so once narration is available again", async () => {
  await mount([clip("once",10)]); await tick(()=>runtime.onTime(10));
  await tick(()=>runtime.reset()); await tick(()=>runtime.onTime(10)); expect(items()).toHaveLength(2);
 });
});
it("assigns a narration exactly at an adjacent boundary to the next loop",()=>{
 const next={...point,id:"next",loopStart:20,loopEnd:30};
 expect(voiceRegionAt(20,[point,next]).id).toBe("next");
 expect(voiceRegionAt(19.999,[point,next]).id).toBe("loop");
});

it("holds a clip whose URL resolves during pause, then queues it only on resume", async () => {
 let resolve!: (url:string)=>void; bus.signed.mockReturnValue(new Promise<string>(r=>resolve=r));
 const clips=[clip("paused",0,"once","storage")]; await mount(clips);
 await tick(()=>runtime.onTime(0));
 await act(async()=>root.render(<Harness clips={clips} enabled={false}/>));
 await tick(()=>resolve("ready.mp3")); expect(items()).toHaveLength(0);
 await act(async()=>root.render(<Harness clips={clips} enabled/>));
 expect(items().map(x=>x.src)).toEqual(["ready.mp3"]);
});

it("repeat survives a lap whose first reported timestamp is slightly after loopStart", async()=>{
 await mount([clip("repeat",10,"repeat")]);
 await tick(()=>{runtime.onStageChange(point.id);runtime.onTime(10);});
 bus.speaking=false;bus.scheduled.clear();
 await tick(()=>{runtime.onTime(19.9);runtime.onTime(10.3);});
 expect(items()).toHaveLength(2);
});
