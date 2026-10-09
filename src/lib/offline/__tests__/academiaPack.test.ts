import { describe, expect, it } from "vitest";
import { compileOfflineBoard, gameAssetIds } from "../academiaPack";
import { createDefaultGame } from "@/lib/slate/defaults";

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
    expect(board?.boardSource.beats.map((beat) => beat.equation)).toEqual(["x + 7 - 7 = 15 - 7", "x = 8"]);
  });

  it("lists uploaded Game media required by offline Play", () => {
    const game = createDefaultGame("Offline");
    game.background.assetId = "owner/slate-assets/background.jpg";
    game.settings.assets.audio = [{ id: "a", assetId: "owner/slate-assets/music.mp3", name: "Music", volume: 1, loop: true }];
    expect(gameAssetIds(game)).toEqual(expect.arrayContaining([
      "owner/slate-assets/background.jpg",
      "owner/slate-assets/music.mp3",
    ]));
  });
});