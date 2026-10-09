import { describe, expect, it } from "vitest";
import {
  imagineCollectorAxis,
  imagineCollectorTargets,
  type ImagineScreenRect,
  type ImagineSweepTarget,
} from "../collectorSweep";
import type { RewardInstance } from "@/lib/slate/types";

const rect = (left: number, top: number, width = 20, height = 20): ImagineScreenRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const target = (
  id: string,
  type: string,
  bounds: ImagineScreenRect | null,
  overrides: Partial<RewardInstance> = {},
): ImagineSweepTarget => ({
  slotId: `slot-${id}`,
  rect: bounds,
  reward: {
    id,
    type,
    state: overrides.state ?? "dormant",
    hidden: overrides.hidden ?? false,
    x: 50,
    y: 50,
  },
});

describe("Imagine collector sweep", () => {
  it("maps Horizontal to left-right and Vertical to up-down", () => {
    expect(imagineCollectorAxis("horizontal-collector")).toBe("x");
    expect(imagineCollectorAxis("vertical-collector")).toBe("y");
    expect(imagineCollectorAxis("math-core")).toBeNull();
  });

  it("orders a horizontal row by physical contact distance", () => {
    const targets = [
      target("far", "retry-heart", rect(260, 100)),
      target("near", "math-core", rect(160, 102)),
      target("other-row", "premium-chain-bomb", rect(190, 180)),
      target("behind", "retry-heart", rect(40, 100)),
    ];
    expect(imagineCollectorTargets("source", "x", 1, rect(100, 100), targets, new Set())
      .map(({ reward }) => reward.id)).toEqual(["near", "far"]);
  });

  it("orders a vertical column by physical contact distance", () => {
    const targets = [
      target("far", "vertical-collector", rect(100, 280)),
      target("near", "horizontal-collector", rect(102, 170)),
      target("other-column", "retry-heart", rect(190, 200)),
    ];
    expect(imagineCollectorTargets("source", "y", 1, rect(100, 100), targets, new Set())
      .map(({ reward }) => reward.id)).toEqual(["near", "far"]);
  });

  it("skips protected, hidden, active, visited and missing targets", () => {
    const targets = [
      target("completion", "mark-seal", rect(150, 100)),
      target("timer", "time-shard", rect(170, 100)),
      target("vault", "math-vault", rect(190, 100)),
      target("hidden", "retry-heart", rect(210, 100), { hidden: true }),
      target("active", "retry-heart", rect(230, 100), { state: "active" }),
      target("visited", "math-core", rect(250, 100)),
      target("offscreen", "retry-heart", null),
      target("eligible", "imagine-energy-ball", rect(270, 100)),
    ];
    expect(imagineCollectorTargets("source", "x", 1, rect(100, 100), targets, new Set(["visited"]))
      .map(({ reward }) => reward.id)).toEqual(["eligible"]);
  });
});