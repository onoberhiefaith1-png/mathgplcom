import { describe, expect, it } from "vitest";
import { clampSlideMove, clampVisualZoom, diagramFlowHeight } from "@/lib/visualTransform";

describe("visual transform rules", () => {
  it("clamps visual zoom from 50% to 500%", () => {
    expect(clampVisualZoom(0.1)).toBe(0.5);
    expect(clampVisualZoom(2.5)).toBe(2.5);
    expect(clampVisualZoom(9)).toBe(5);
  });

  it("reserves the enlarged diagram height in document flow", () => {
    expect(diagramFlowHeight({ authoredHeight: 320, naturalHeight: 200, zoom: 1 })).toBe(320);
    expect(diagramFlowHeight({ authoredHeight: 320, naturalHeight: 200, zoom: 3, offsetY: 40 })).toBe(640);
  });

  it("uses one proportional zoom factor for document and presentation visuals", () => {
    expect(clampVisualZoom(1)).toBe(1);
    expect(clampVisualZoom(3)).toBe(3);
    expect(900 / 1600).toBe(0.5625);
  });

  it("allows slide bleed while keeping a recoverable part visible", () => {
    expect(clampSlideMove(-4, 2)).toBeCloseTo(-1.92);
    expect(clampSlideMove(4, 2)).toBeCloseTo(0.92);
    expect(clampSlideMove(-0.4, 2)).toBe(-0.4);
  });
});