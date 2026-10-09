import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeometryDiagram } from "../GeometryDiagram";
import type { GeometryScene } from "@/lib/geometry/scene";

const scene = {
  bounds: { width: 180, height: 100 },
  objects: [
    { id: "A", type: "point", x: 20, y: 70, label: "A" },
    { id: "B", type: "point", x: 150, y: 70, label: "B" },
    { id: "AB", type: "segment", a: "A", b: "B" },
  ],
  meta: {
    geometryMap: {
      version: 2,
      published: true,
      generatedFromSolution: false,
      items: [],
      colors: { AB: "#e11d48" },
    },
  },
} as GeometryScene;

describe("GeometryDiagram review colours", () => {
  it("keeps stored relationship colours hidden while the diagram is resting", () => {
    const html = renderToStaticMarkup(<GeometryDiagram scene={scene} stroke="#111111" />);
    expect(html).toContain("#111111");
    expect(html).not.toContain("#e11d48");
  });

  it("reveals the stored colour only when its object is selected", () => {
    const html = renderToStaticMarkup(
      <GeometryDiagram scene={scene} stroke="#111111" highlightIds={["AB"]} />,
    );
    expect(html).toContain("#e11d48");
  });
});