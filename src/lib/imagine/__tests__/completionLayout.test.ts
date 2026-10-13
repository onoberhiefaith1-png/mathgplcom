import { describe, expect, it } from "vitest";
import { completionLayout } from "../completionLayout";

describe("result character safe geometry", () => {
  it.each([[393, 503], [768, 1024], [1280, 800]])("keeps character in its reserved footer at %s×%s", (width, height) => {
    const layout = completionLayout(width, height, 10);
    expect(layout.characterHeight).toBeLessThanOrEqual(layout.footerHeight - 8);
    expect(layout.characterWidth).toBeLessThanOrEqual(width * 0.34);
    expect(layout.footerHeight).toBeLessThanOrEqual(height * 0.3);
  });
});