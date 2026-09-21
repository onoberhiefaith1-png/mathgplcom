import { describe, expect, it } from "vitest";
import { visibleTestRenderer } from "./displayMode";

describe("Game test display selector", () => {
  it("keeps exactly one visual renderer visible", () => {
    expect(visibleTestRenderer("surface", "tiles")).toBe("surface");
    expect(visibleTestRenderer("surface", "dimensional")).toBe("surface");
    expect(visibleTestRenderer("threeD", "tiles")).toBe("tiles");
    expect(visibleTestRenderer("threeD", "royal")).toBe("dimensional");
    expect(visibleTestRenderer(undefined, "chalk")).toBe("dimensional");
  });
});