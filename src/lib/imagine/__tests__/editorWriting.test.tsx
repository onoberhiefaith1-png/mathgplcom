// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorSurfaceText } from "@/components/imagine/EditorSurfaceText";
import { applyWritingKey, editorWritingPresentation } from "../editorWriting";

describe("editor writing surface", () => {
  it("turns keystrokes into the text on the surface", () => {
    expect(applyWritingKey("", "x")).toBe("x");
    expect(applyWritingKey("x", "+")).toBe("x+");
    expect(applyWritingKey("x+", "Backspace")).toBe("x");
    expect(applyWritingKey("x", "Enter")).toBe("x\n");
    expect(applyWritingKey("x", "Shift")).toBeNull();
  });

  it("shows typing live in the current size and colour", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <EditorSurfaceText value="" label="Writing line 1" colour="#112233" sizePx={36} active onChange={onChange} />,
    );
    const field = screen.getByRole("textbox", { name: "Writing line 1" });
    fireEvent.change(field, { target: { value: "x + 7" } });
    expect(onChange).toHaveBeenCalledWith("x + 7");
    expect((field as HTMLTextAreaElement).value).toBe("x + 7");
    expect(field.style.fontSize).toBe("36px");
    expect(field.style.color).toBe("rgb(17, 34, 51)");

    rerender(
      <EditorSurfaceText value="x + 7" label="Writing line 1" colour="#aa3311" sizePx={48} active onChange={onChange} />,
    );
    const next = screen.getByRole("textbox", { name: "Writing line 1" });
    expect(next.style.fontSize).toBe("48px");
    expect(next.style.color).toBe("rgb(170, 51, 17)");
  });

  it("keeps the iPhone keyboard from zooming a small preview", () => {
    expect(editorWritingPresentation(12, "#173f91")).toMatchObject({
      fontSize: "16px",
      color: "#173f91",
      transform: "scale(0.75)",
    });
    expect(editorWritingPresentation(28, "#173f91").fontSize).toBe("28px");
  });
});
