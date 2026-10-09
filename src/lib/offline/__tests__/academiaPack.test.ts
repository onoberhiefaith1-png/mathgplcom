import { describe, expect, it } from "vitest";
import { compileOfflineBoard, gameAssetIds } from "../academiaPack";
import { defaultAssetSettings, defaultGameStatus, defaultSettings } from "@/lib/slate/defaults";
import type { Game } from "@/lib/slate/types";

describe("full-fidelity Academia pack", () => {
  it("keeps one question and each solution line on its own board line", () => {
    const board = compileOfflineBoard({
      activityId: "activity-1",
      subsectionId: "question-1",
      title: "Solve",
      lines: [
        { lineId: "q", equation: "x + 7 = 15", fillers: [], containers: [], arrangement: [] },
        { lineId: "l1", equation: "x + 7 - 7 = 15 - 7", fillers: ["x", "+7", "-7", "=", "15", "-7"], containers: [], arrangement: [], marks: 1 },
        { lineId: "l2", equation: "x = 8", fillers: ["x", "=", "8"], containers: [], arrangement: [], marks: 1 },
      ],
    });
    expect(board?.questionText).toBe("x + 7 = 15");
    expect(board?.lineIds).toEqual(["l1", "l2"]);
    expect(board?.boardSource.reservoirs[0]?.lines.map((line) => line.equation)).toEqual(["x + 7 - 7 = 15 - 7", "x = 8"]);
  });

  it("keeps Line 1 when the question is stored separately", () => {
    const board = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Solve", questionText: "x + 7 = 15",
      lines: [
        { lineId: "l1", equation: "x + 7 - 7 = 15 - 7", fillers: [], containers: [], arrangement: [] },
        { lineId: "l2", equation: "x = 8", fillers: [], containers: [], arrangement: [] },
      ],
    });
    expect(board?.questionText).toBe("x + 7 = 15");
    expect(board?.lineIds).toEqual(["l1", "l2"]);
  });

  it("drops only a verbatim restatement of the question", () => {
    const board = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Solve", questionText: "x+7=15",
      lines: [
        { lineId: "q", equation: "x + 7 = 15", fillers: [], containers: [], arrangement: [] },
        { lineId: "l1", equation: "x = 8", fillers: [], containers: [], arrangement: [] },
      ],
    });
    expect(board?.lineIds).toEqual(["l1"]);
  });

  it("lists uploaded Game media required by offline Play", () => {
    const game: Game = {
      id: "g", name: "Offline", topic: "", subtopic: "", surfaceId: "plain", roomId: "forest-room",
      background: { src: null, assetId: null, kind: "image", scale: 1, x: 0, y: 0, opacity: 1 },
      slots: [], settings: defaultSettings(), status: defaultGameStatus(), patternLength: 1, updatedAt: 0,
    };
    game.settings.assets = defaultAssetSettings();
    game.background.assetId = "owner/slate-assets/background.jpg";
    game.settings.assets.audio = [{ id: "a", assetId: "owner/slate-assets/music.mp3", name: "Music", volume: 1, loop: true }];
    expect(gameAssetIds(game)).toEqual(expect.arrayContaining([
      "owner/slate-assets/background.jpg",
      "owner/slate-assets/music.mp3",
    ]));
  });
});