import { describe, expect, it } from "vitest";
import { buildLessonOutline } from "@/lib/lessonnotes/lessonOutline";
import { SLIDE_PAGE } from "@/lib/lessonnotes/slides";
import { structuralHeadingKind } from "@/lib/lessonnotes/sectionKinds";

describe("Canvas presentation sessions", () => {
  it("recognizes a stamped Canvas as a structural, non-question session", () => {
    expect(structuralHeadingKind("My presentation", 2, { sessionKind: "canvas" })?.kind).toBe("canvas");
  });

  it("preserves the selected Canvas identity in the lesson outline", () => {
    const outline = buildLessonOutline({
      type: "doc",
      content: [{
        type: "heading",
        attrs: { level: 2, sessionKind: "canvas", canvasId: "canvas-1" },
        content: [{ type: "text", text: "Canvas" }],
      }, { type: "paragraph" }],
    });
    expect(outline).toHaveLength(1);
    expect(outline[0]).toMatchObject({ kind: "canvas", canvasId: "canvas-1", isSolution: false });
  });

  it("uses one landscape 16:9 coordinate system", () => {
    expect(SLIDE_PAGE.w / SLIDE_PAGE.h).toBeCloseTo(16 / 9, 6);
  });
});