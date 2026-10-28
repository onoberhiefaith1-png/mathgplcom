/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ video: null as any, mounts: 0, propsSeen: [] as any[] }));
vi.mock("@/components/gamebuilder/ProgressColumn", () => ({ default: (p: any) => <div data-testid="column" data-marks={p.config.currentMarks} /> }));
vi.mock("@/components/assets/QuestionProgressContainer", () => ({ default: () => <div data-testid="liquid" /> }));
vi.mock("@/hooks/useGameRuntime", () => ({ gameSoundSettingsOf: () => ({ background: null }) }));
vi.mock("@/lib/slate/gameSound", () => ({ applyBackgroundSound: vi.fn(), holdBackgroundSound: vi.fn(), prepareGameSounds: vi.fn(), prepareSound: vi.fn(), setBackgroundVolume: vi.fn(), setSoundMaster: vi.fn(), stopBackgroundSound: vi.fn() }));
vi.mock("@/lib/slate/assets", () => ({ primeAssetUrl: vi.fn() }));
vi.mock("@/lib/games/urls", () => ({ primeSignedUrls: vi.fn(), getSignedUrl: vi.fn() }));
vi.mock("@/lib/games/audio", () => ({ unlockAudio: vi.fn(), setChannelVolume: vi.fn() }));
vi.mock("@/lib/games/narration", () => ({ useNarrationPlayback: () => ({ reset: vi.fn(), onLoopStart: vi.fn(), onStageChange: vi.fn(), onTime: vi.fn() }) }));
vi.mock("@/lib/games/games", () => ({ getGame: vi.fn() }));
vi.mock("@/lib/slate/storage", () => ({ loadGame: vi.fn() }));
vi.mock("@/lib/academia/adventureSlots", () => ({
  listAdventureQuestions: vi.fn(), listPassMarks: vi.fn(), loadAdventureAudio: vi.fn(),
  boardFor: (q: any) => (q.broken ? (() => { throw new Error("bad board"); })() : { questionRowId: q.id, totalMarks: q.totalMarks }),
}));
vi.mock("@/components/gamebuilder/VideoBackgroundLayer", () => ({ default: (props: any) => { state.video = props; return <div>Video</div>; } }));
vi.mock("@/pages/imagine/ImaginePlayPage", async () => {
  const React = await import("react");
  return { default: function MockImagine(props: any) { state.propsSeen.push(props.offline); React.useEffect(() => { state.mounts += 1; }, []); return <div>Game surface</div>; } };
});
import AcademiaAdventurePlayer from "@/components/academia/AcademiaAdventurePlayer";
import { DEFAULT_AUDIO } from "@/lib/academia/adventureMix";
import type { OfflineAdventure } from "../extendedActivities";

const bar = (id: string, role?: string) => ({ id, kind: "progress_bar", storagePath: "", mediaType: "image", progress: { role, segments: 10, currentMarks: 0, totalMarks: 1, timeDurationSeconds: role === "time" ? 60 : undefined } });
const adventure = (over: Record<string, unknown> = {}, scene: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: "video",
  canvas: { video: { path: "/movie.mp4", source: "url" }, narrations: [], scenes: [{ id: "point", loopStart: 10, loopEnd: 20, elements: [], ...scene }] },
  questions: [{ id: "q1", sceneId: "point", activityId: "a", totalMarks: 4, lines: [], position: 0 }],
  pass: { point: 75 }, game: { id: "game", status: { lives: 3 } }, audio: DEFAULT_AUDIO, assetUrls: {}, ...over, ...extra,
}) as unknown as OfflineAdventure;

let root: Root; let host: HTMLElement;
beforeEach(() => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/academia-app" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "localStorage"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.mounts = 0; state.propsSeen = []; state.video = null;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

async function play(offline: OfflineAdventure) {
  await act(async () => root.render(<AcademiaAdventurePlayer activityId="a" adventureId="video" gameId="game" offline={offline} onExit={vi.fn()} />));
  await act(async () => state.video.onReady());
  const start = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Start Adventure"))!;
  await act(async () => start.click());
}
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`);

it("keeps Start hidden until the video has reported itself, with a visible 'Getting ready'", async () => {
  await act(async () => root.render(<AcademiaAdventurePlayer activityId="a" adventureId="video" gameId="game" offline={adventure()} onExit={vi.fn()} />));
  expect(host.textContent).toContain("Getting ready");
  expect(host.textContent).not.toContain("Start Adventure");
  await act(async () => state.video.onReady());
  expect(host.textContent).toContain("Start Adventure");
});

it("opens the Game at a point the playhead already ran past", async () => {
  await play(adventure());
  await act(async () => state.video.onTime(31)); // loop was 10–20: the playhead jumped over it
  expect(host.textContent).toContain("Game surface");
});

it("hands the Game ONE props object however often the playhead re-renders, and mounts it once", async () => {
  await play(adventure());
  await act(async () => state.video.onTime(12));
  const first = state.propsSeen.at(-1);
  for (const t of [12.1, 12.3, 12.6, 13, 13.4]) await act(async () => state.video.onTime(t));
  expect(state.propsSeen.at(-1)).toBe(first);
  expect(state.propsSeen.every((p) => p === first)).toBe(true);
  expect(state.mounts).toBe(1);
});

it("always shows a learning bar: a plain default when none is designed", async () => {
  await play(adventure());
  await act(async () => state.video.onTime(12));
  expect(q("default-bar")).not.toBeNull();
  expect(q("designed-bar")).toBeNull();
});

it("draws the teacher's designed bars at the geometry stored in the editor, inside the video's stage", async () => {
  const placed = (id: string, role: string, x: number, y: number, scale: number, rotation: number) => ({ ...bar(id, role), x, y, scale, rotation, z: 2, opacity: 0.9 });
  await play(adventure({}, { elements: [placed("t", "time", 0.1, 0.4, 0.05, 0), placed("l", "learning", 0.83, 0.3, 0.08, -10)] }));
  await act(async () => state.video.onTime(12));
  const stage = q("adventure-stage") as HTMLElement;
  const layer = q("bar-layer") as HTMLElement;
  expect(stage.contains(layer)).toBe(true);
  const designed = [...layer.querySelectorAll('[data-testid="designed-bar"]')] as HTMLElement[];
  expect(designed).toHaveLength(2);
  const wrapperOf = (label: string) => (layer.querySelector(`[aria-label="${label}"]`) as HTMLElement).firstElementChild as HTMLElement;
  const learning = wrapperOf("Learning progress");
  expect(learning.style.left).toBe("83%");
  expect(learning.style.top).toBe("30%");
  expect(learning.style.width).toBe("8%");
  expect((learning.firstElementChild as HTMLElement).style.transform).toContain("rotate(-10deg)");
  const time = wrapperOf("Time left");
  expect(time.style.left).toBe("10%");
  expect(time.style.width).toBe("5%");
  // The live value reaches the bar.
  expect((learning.querySelector('[data-testid="column"]') as HTMLElement).getAttribute("data-marks")).toBe("0");
});

it("keeps the bars behind the Game and out of the way of touches", async () => {
  await play(adventure({}, { elements: [bar("t", "time"), bar("l", "learning")] }));
  await act(async () => state.video.onTime(12));
  const stage = q("adventure-stage") as HTMLElement;
  const layer = q("bar-layer") as HTMLElement;
  const game = [...host.querySelectorAll("div")].find((d) => d.className.includes("z-10") && d.textContent?.includes("Game surface"))!;
  expect(game).toBeTruthy();
  expect(game.contains(layer)).toBe(false);
  expect(game.contains(q("bar-edge-layer"))).toBe(false);
  // Painted below the Game layer (z-10) and below every control (z-20+).
  expect(Number(stage.style.zIndex)).toBeLessThan(10);
  expect(Number((q("bar-edge-layer") as HTMLElement).style.zIndex)).toBeLessThan(10);
  expect(layer.className).toContain("pointer-events-none");
  expect(stage.className).toContain("pointer-events-none");
  expect(q("bar-edge-layer")!.className).toContain("pointer-events-none");
  // Still updating: the bar exists and is visible while the point is open.
  expect(host.querySelector('[aria-label="Learning progress"]')).not.toBeNull();
});

it("uses a plain default only for a bar the creator never placed", async () => {
  await play(adventure({}, { elements: [bar("t", "time")] }));
  await act(async () => state.video.onTime(12));
  expect((q("designed-bar") as HTMLElement).getAttribute("aria-label")).toBe("Time left");     // designed
  expect((q("default-bar") as HTMLElement).getAttribute("aria-label")).toBe("Learning progress"); // never placed: plain default
});

it("sizes the stage like the video: the 16:9 frame covering the player", async () => {
  await play(adventure());
  const stage = q("adventure-stage") as HTMLElement;
  // The jsdom window is 1024 × 768: a 16:9 frame covering it is 1365 × 768, centred.
  expect(stage.style.height).toBe("768px");
  expect(parseFloat(stage.style.width)).toBeCloseTo(768 * 16 / 9, 0);
});

it("shows the time bar whenever the point has a countdown — here from its designed Time bar", async () => {
  await play(adventure({}, { elements: [bar("t", "time"), bar("l", "learning")] }));
  await act(async () => state.video.onTime(12));
  expect(host.querySelector('[aria-label="Time left"]')).not.toBeNull();
});

it("shows the time bar from the older per-point timer", async () => {
  await play(adventure({}, { timerEnabled: true, timeLimit: 45 }));
  await act(async () => state.video.onTime(12));
  expect(host.querySelector('[aria-label="Time left"]')).not.toBeNull();
});

it("hides the time bar when the teacher hid the timer on that point", async () => {
  await play(adventure({}, { timerEnabled: true, timeLimit: 45, timerVisible: false }));
  await act(async () => state.video.onTime(12));
  expect(host.querySelector('[aria-label="Time left"]')).toBeNull();
});

it("has no time bar when the point has no countdown at all", async () => {
  await play(adventure());
  await act(async () => state.video.onTime(12));
  expect(host.querySelector('[aria-label="Time left"]')).toBeNull();
});

it("never leaves a dead end: a point whose questions cannot be compiled offers to skip it", async () => {
  await play(adventure({ questions: [{ id: "q1", sceneId: "point", activityId: "a", totalMarks: 4, lines: [], position: 0, broken: true }] }));
  await act(async () => state.video.onTime(12));
  expect(host.textContent).toContain("These questions could not be prepared");
  expect(host.textContent).not.toContain("Game surface");
  const skip = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Skip this learning point"))!;
  await act(async () => skip.click());
  expect(host.textContent).not.toContain("These questions could not be prepared");
});

it("says so, with a skip, when the Game for the point is missing", async () => {
  await play(adventure({ game: null }));
  await act(async () => state.video.onTime(12));
  expect(host.textContent).toContain("could not be loaded");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent?.includes("Skip this learning point"))).toBe(true);
});

it("paints the bundled castle under the video and hides a failed video instead of going dark", async () => {
  await play(adventure());
  const castle = q("adventure-backdrop") as HTMLImageElement;
  expect(castle.getAttribute("src")).toBe("/offline-game/castle.webp");
  expect(state.video.className).toBe("opacity-0"); // no frame yet: castle shows
  await act(async () => state.video.onError());
  expect(host.querySelector("[role=status]")?.textContent).toMatch(/video/i);
  await act(async () => state.video.onFrame());
  expect(state.video.className).toBeUndefined(); // frame arrived: video shows
  expect(host.querySelector("[role=status]")).toBeNull();
});

it("with no video at all, 'Continue without the video' still opens the learning point", async () => {
  await play(adventure());
  await act(async () => state.video.onError());
  expect(host.textContent).not.toContain("Game surface");
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Continue without the video"))!;
  await act(async () => button.click());
  expect(host.textContent).toContain("Game surface");
  expect(q("adventure-backdrop")).not.toBeNull();
});
