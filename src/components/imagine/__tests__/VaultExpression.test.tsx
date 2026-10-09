// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VaultExpression } from "../ImagineStage";

describe("Game Vault expression", () => {
  it("renders a saved fraction structurally without exposing raw LaTeX", () => {
    const { container } = render(<VaultExpression expression="\\frac{15}{3}" />);
    const vault = container.querySelector<HTMLElement>("[data-game-vault-expression]");

    expect(vault).not.toBeNull();
    expect(vault?.textContent).not.toContain("\\frac");
    expect(vault?.querySelectorAll("[data-math-kind='fraction']").length).toBeGreaterThan(0);
  });
});