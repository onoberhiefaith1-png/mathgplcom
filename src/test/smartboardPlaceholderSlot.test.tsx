import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MathTreeRender } from "@/components/smartboard/MathTreeRender";
import { insertChar, mkChar, type Row } from "@/lib/smartboard/mathTree";

const view = (root: Row) =>
  render(
    <MathTreeRender
      root={root}
      cursor={{ path: [], index: 0 }}
      onCursorChange={() => {}}
      caretColor="#22d3ee"
      placeholderColor="#efece5"
    />,
  );

describe("smartboard placeholder slots", () => {
  it("never renders a literal □ as ink text", () => {
    const { container } = view([mkChar("x"), mkChar("="), mkChar("□")]);
    expect(container.textContent).not.toContain("□");
    expect(container.querySelectorAll("[data-sb-placeholder]").length).toBe(1);
  });

  it("typing replaces the slot instead of sitting beside it", () => {
    const root: Row = [mkChar("□")];
    const next = insertChar(root, { path: [], index: 0 }, "5");
    expect(next.root).toHaveLength(1);
    expect(next.root[0]).toMatchObject({ kind: "char", ch: "5" });
    expect(next.cursor).toEqual({ path: [], index: 1 });

    const { container } = view(next.root);
    expect(container.querySelectorAll("[data-sb-placeholder]").length).toBe(0);
    expect(container.textContent).toBe("5");
  });

  it("a fraction shell shows exactly two slots, never nested", () => {
    const { container } = view([{ kind: "frac", rows: [[], []] } as never]);
    const slots = container.querySelectorAll("[data-sb-placeholder]");
    expect(slots.length).toBe(2);
    slots.forEach((s) => {
      expect(s.querySelector("[data-sb-placeholder]")).toBeNull();
    });
  });
});
