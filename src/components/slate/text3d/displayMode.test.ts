import { describe, expect, it } from "vitest";
import { HIDDEN_3D_LAYOUT_TEXT, visibleTestRenderer } from "./displayMode";

describe("Game test display selector", () => {
  it("keeps exactly one visual renderer visible", () => {
    expect(visibleTestRenderer("surface", "tiles")).toBe("surface");
    expect(visibleTestRenderer("surface", "dimensional")).toBe("surface");
    expect(visibleTestRenderer("threeD", "tiles")).toBe("tiles");
    expect(visibleTestRenderer("threeD", "royal")).toBe("dimensional");
    expect(visibleTestRenderer(undefined, "chalk")).toBe("dimensional");
  });

  it("keeps the internal 3D layout text mounted but fully invisible and non-interactive", () => {
    expect(HIDDEN_3D_LAYOUT_TEXT.fillOpacity).toBe(0);
    expect(HIDDEN_3D_LAYOUT_TEXT.outlineOpacity).toBe(0);
    expect(HIDDEN_3D_LAYOUT_TEXT.depthWrite).toBe(false);
    expect(HIDDEN_3D_LAYOUT_TEXT.raycast()).toBeNull();
  });
});