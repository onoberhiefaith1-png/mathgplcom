import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ video: null as any, player: null as any, getGame: vi.fn(), loadGame: vi.fn(), listQuestions: vi.fn() }));
vi.mock("@/components/gamebuilder/ProgressColumn", () => ({ default: () => null }));
vi.mock("@/hooks/useGameRuntime", () => ({ gameSoundSettingsOf: () => ({ background: null }) }));
vi.mock("@/lib/slate/gameSound", () => ({ applyBackgroundSound: vi.fn(), holdBackgroundSound: vi.fn(), prepareGameSounds: vi.fn(), prepareSound: vi.fn(), setBackgroundVolume: vi.fn(), setSoundMaster: vi.fn(), stopBackgroundSound: vi.fn() }));
vi.mock("@/lib/slate/assets", () => ({ primeAssetUrl: vi.fn() }));
vi.mock("@/lib/games/urls", () => ({ primeSignedUrls: vi.fn(), getSignedUrl: vi.fn() }));
vi.mock("@/lib/games/audio", () => ({ unlockAudio: vi.fn(), setChannelVolume: vi.fn() }));
vi.mock("@/lib/games/narration", () => ({ useNarrationPlayback: () => ({ reset: vi.fn(), onLoopStart: vi.fn(), onStageChange: vi.fn(), onTime: vi.fn() }) }));
vi.mock("@/lib/games/games", () => ({ getGame: state.getGame }));
vi.mock("@/lib/slate/storage", () => ({ loadGame: state.loadGame }));
vi.mock("@/lib/academia/adventureSlots", () => ({ listAdventureQuestions: state.listQuestions, listPassMarks: vi.fn(), loadAdventureAudio: vi.fn(), boardFor: (q: any) => ({ questionRowId: q.id, totalMarks: q.totalMarks, boardSource: {} }) }));
vi.mock("@/components/gamebuilder/VideoBackgroundLayer", () => ({ default: (props: any) => { state.video = props; return <div>Video</div>; } }));
vi.mock("@/pages/imagine/ImaginePlayPage", () => ({ default: (props: any) => { state.player = props; return <div>Copied question board</div>; } }));
import AcademiaAdventurePlayer from "@/components/academia/AcademiaAdventurePlayer";
import { DEFAULT_AUDIO } from "@/lib/academia/adventureMix";
import type { OfflineAdventure } from "../extendedActivities";

it("starts the shared Adventure player and opens copied questions without database requests", async () => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/academia-app" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "localStorage"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const offline = { id: "video", canvas: { video: { path: "/movie.mp4", source: "url" }, narrations: [], scenes: [{ id: "point", loopStart: 1, loopEnd: 5, elements: [] }] },
    questions: [{ id: "copied", sceneId: "point", activityId: "activity", totalMarks: 2, lines: [], position: 0 }],
    pass: { point: 75 }, game: { id: "game", status: { lives: 3 } }, audio: DEFAULT_AUDIO,
    assetUrls: { "owner/picture.png": "/api/public/academia-media?gameAsset=owner%2Fpicture.png&activity=activity" },
  } as unknown as OfflineAdventure;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<AcademiaAdventurePlayer activityId="activity" adventureId="video" gameId="game" offline={offline} onExit={vi.fn()} />));
    expect(host.textContent).toContain("Start Adventure");
    expect(state.video.video.path).toContain("_aof=1");
    const start = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Start Adventure"))!;
    await act(async () => start.click());
    await act(async () => state.video.onTime(2));
    expect(host.textContent).toContain("Copied question board");
    expect(state.player.offline.boards[0].questionRowId).toBe("copied");
    expect(state.player.offline.assetUrls["owner/picture.png"]).toContain("_aof=1");
    expect(state.getGame).not.toHaveBeenCalled(); expect(state.loadGame).not.toHaveBeenCalled(); expect(state.listQuestions).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
