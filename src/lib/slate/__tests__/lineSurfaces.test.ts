import { describe, expect, it } from "vitest";
import {
  fractionSeconds,
  lineSurfacesInSync,
  normalizeLineConfig,
  previewSlots,
  resolveRenderedLineSlot,
  syncLineSurfaces,
  vaultMatches,
} from "../lineSurfaces";
import { mapQuestionLines } from "../pattern";
import { makeGame } from "../defaults";

const game = () =>
  makeGame({
    name: "Test",
    topic: "",
    subtopic: "",
    surfaceId: "stone-wall",
    lines: 4,
    background: { src: null, assetId: null, kind: "image", scale: 1, x: 0, y: 0, opacity: 1 },
  });

describe("line time fractions", () => {
  it("never invents a bonus of its own", () => {
    expect(fractionSeconds(null, "full")).toBe(0);
    expect(fractionSeconds(60, "full")).toBe(60);
    expect(fractionSeconds(60, "half")).toBe(30);
    expect(fractionSeconds(60, "third")).toBe(20);
    expect(fractionSeconds(60, "quarter")).toBe(15);
  });
});

describe("one line, one surface", () => {
  it("creates a surface per line and removes orphans", () => {
    const first = syncLineSurfaces(undefined, ["a", "b", "c"]);
    expect(Object.keys(first)).toEqual(["a", "b", "c"]);
    const edited = { ...first, b: { ...first.b!, vaultExpression: "x + 7" } };
    const next = syncLineSurfaces(edited, ["b", "d"]);
    expect(Object.keys(next)).toEqual(["b", "d"]);
    expect(next.b!.vaultExpression).toBe("x + 7");
    expect(lineSurfacesInSync(next, ["b", "d"])).toBe(true);
    expect(lineSurfacesInSync(next, ["b"])).toBe(false);
  });

  it("inherits the saved pattern surface and scene when no line override exists", () => {
    const g = game();
    g.settings.text = {
      ...g.settings.text,
      preset: "royal3d",
      faceColour: "#123456",
      depthColour: "#654321",
    };
    g.slots[0] = { ...g.slots[0]!, surfaceId: "cloud", scene: { ...g.slots[0]!.scene, scale: 1.7 } };
    const resolved = resolveRenderedLineSlot(g, {
      line: 1,
      isQuestion: false,
      lineId: "L1",
      patternSlot: 1,
      text: "x + 1 = 3",
      rewards: g.slots[0]!.rewards,
    });
    expect(resolved.surfaceId).toBe("cloud");
    expect(resolved.scene).toBe(g.slots[0]!.scene);
    expect(resolved.text).toBe("x + 1 = 3");
    expect(g.settings.text.preset).toBe("royal3d");
  });

  it("uses an explicit line surface without changing saved slot appearance", () => {
    const g = game();
    g.slots[0] = { ...g.slots[0]!, surfaceId: "cloud" };
    g.settings.lines = {
      L1: { lineId: "L1", surfaceId: "glass", hourglassReward: "full", vaultCodes: [] },
    };
    const resolved = previewSlots(g, [{ equation: "2x = 8", lineId: "L1" }], () => [
      { id: "saved", type: "retry-heart", state: "dormant", hidden: false, x: 27, y: 63 },
    ])[0]!;
    expect(resolved.surfaceId).toBe("glass");
    expect(resolved.scene).toBe(g.slots[0]!.scene);
    expect(resolved.rewards[0]).toMatchObject({ x: 27, y: 63 });
  });
});

describe("derived line objects", () => {
  it("gives a line with its own time an Hourglass worth the chosen share", () => {
    const g = game();
    g.settings.lines = {
      L1: { lineId: "L1", surfaceId: null, hourglassReward: "half", vaultCodes: [] },
    };
    const rows = mapQuestionLines(g, [60, null], ["L1", "L2"]);
    expect(rows[0]!.isQuestion).toBe(true);
    expect(rows[0]!.rewards).toHaveLength(0);
    const hourglass = rows[1]!.rewards.find((r) => r.type === "time-shard");
    expect(hourglass).toBeTruthy();
    // the Hourglass sits on the right-hand side of its own line
    expect(hourglass!.x).toBeGreaterThan(50);
    expect(rows[1]!.hourglassSeconds).toBe(30);
    expect(rows[2]!.rewards.some((r) => r.type === "time-shard")).toBe(false);
  });

  it("reads a legacy single expression as the line's first Vault Code", () => {
    const g = game();
    g.settings.lines = {
      L1: normalizeLineConfig("L1", {
        lineId: "L1",
        surfaceId: null,
        hourglassReward: "full",
        vaultExpression: "x + 7",
        vaultCoins: 3,
      }),
    };
    const rows = mapQuestionLines(g, [null], ["L1"]);
    const vault = rows[1]!.rewards.find((r) => r.type === "math-vault");
    expect(vault?.expression).toBe("x + 7");
    expect(vault?.coins).toBe(3);
  });

  it("gives a line one Vault per Vault Code", () => {
    const g = game();
    g.settings.lines = {
      L1: normalizeLineConfig("L1", {
        vaultCodes: [
          { expression: "x + 7", reward: 2 },
          { expression: "2x + 6", reward: 5 },
        ],
      }),
    };
    const rows = mapQuestionLines(g, [null], ["L1"]);
    const vaults = rows[1]!.rewards.filter((r) => r.type === "math-vault");
    expect(vaults.map((v) => v.expression)).toEqual(["x + 7", "2x + 6"]);
    expect(vaults.map((v) => v.coins)).toEqual([2, 5]);
  });
});

describe("the Vault compares mathematics", () => {
  it("opens for the same method written differently", () => {
    expect(vaultMatches("x + 7", "7 + x")).toBe(true);
    expect(vaultMatches("2x = 8", "2x=8")).toBe(true);
    expect(vaultMatches("x + 7", "x - 7")).toBe(false);
    expect(vaultMatches("x + 7", "")).toBe(false);
    expect(vaultMatches(null, "x + 7")).toBe(false);
  });
});
