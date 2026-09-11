import { describe, expect, it } from "vitest";
import CanvasFrame from "@/components/lessonnotes/extensions/CanvasFrame";
import { GeometryDiagramNode } from "@/components/lessonnotes/extensions/GeometryDiagram";

/** A diagram is a document block: no object may be positioned over the text. */
describe("diagrams stay in the document flow", () => {
  it("never absolutely positions a frame, diagrams included", () => {
    const render = (CanvasFrame as any).config.renderHTML as (arg: any) => any;
    for (const kind of ["diagram", "solution", null]) {
      const out = render({
        HTMLAttributes: {},
        node: { attrs: { x: 40, y: 300, w: 420, objectKind: kind } },
      });
      const style = String(out[1].style);
      expect(style).toContain("position:relative");
      expect(style).not.toContain("position:absolute");
    }
  });

  it("gives the diagram block its own reserved height", () => {
    const attrs = (GeometryDiagramNode as any).config.addAttributes.call({}) as Record<string, any>;
    expect(attrs.height).toBeDefined();
    expect(attrs.height.default).toBe(0);
    expect(attrs.height.renderHTML({ height: 260 })).toEqual({ "data-height": "260" });
  });
});
