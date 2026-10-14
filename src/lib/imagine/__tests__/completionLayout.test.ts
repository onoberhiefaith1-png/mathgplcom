import { describe, expect, it } from "vitest";
import { completionLayout } from "../completionLayout";

describe("result character safe geometry", () => {
  it.each([[962, 503], [1280, 800], [1024, 768]])("wide %s×%s: character has its own column beside the card", (width, height) => {
    const l = completionLayout(width, height, 10);
    expect(l.sideWidth).toBeGreaterThanOrEqual(l.characterWidth + 16);
    expect(l.characterWidth).toBeLessThanOrEqual(width * 0.22);
    expect(l.characterHeight).toBeLessThanOrEqual(height - 24);
  });

  it.each([[393, 503], [393, 852]])("phone %s×%s: small character stays in the footer", (width, height) => {
    const l = completionLayout(width, height, 10);
    expect(l.sideWidth).toBe(0);
    expect(l.characterHeight).toBeLessThanOrEqual(l.footerHeight - 8);
    expect(l.footerHeight).toBeLessThanOrEqual(height * 0.27);
  });

  it("short laptop screens use the dense card", () => {
    expect(completionLayout(962, 503).dense).toBe(true);
    expect(completionLayout(1280, 900).dense).toBe(false);
  });
});
