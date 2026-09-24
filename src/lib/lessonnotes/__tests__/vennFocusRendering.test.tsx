import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VennEngineCanvas } from "@/components/lessonnotes/extensions/visuals/vennEngine/VennEngineCanvas";
import { buildVennPreset } from "@/components/lessonnotes/extensions/visuals/vennEngine/presets";

describe("Venn teaching focus rendering", () => {
  it("neutralises circle fills and paints an exact masked region in focus mode", () => {
    const model = buildVennPreset("venn3");
    model.sets = model.sets.map((set, index) => ({ ...set, label: ["Mathematics", "Science", "C"][index] }));
    model.focusExpression = "A";

    const html = renderToStaticMarkup(
      <VennEngineCanvas
        model={model}
        selectedRegion={null}
        selectedSet={null}
        onSelectRegion={() => undefined}
        onSelectSet={() => undefined}
        onChange={() => undefined}
        editable={false}
      />,
    );

    expect(html).toContain('data-venn-mode="focus"');
    expect(html).toContain('data-focus-expression="A"');
    expect(html).toContain("venn-region-mask-");
    expect(html).toContain('fill="hsl(var(--venn-focus))"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="#3B82F6"');
    expect(html).toContain('stroke="#F97316"');
    expect(html).toContain('stroke="#22C55E"');
    expect(html).toContain("Venn diagram focusing Mathematics only");
  });

  it("renders a disjoint intersection as an empty mathematical focus", () => {
    const model = buildVennPreset("vennDisjoint");
    model.focusExpression = "AB";
    const html = renderToStaticMarkup(
      <VennEngineCanvas
        model={model}
        selectedRegion={null}
        selectedSet={null}
        onSelectRegion={() => undefined}
        onSelectSet={() => undefined}
        onChange={() => undefined}
        editable={false}
      />,
    );
    expect(html).toContain("∅ — No common region");
    expect(html).not.toContain('fill="hsl(var(--venn-focus))"');
  });

  it("keeps old diagrams in overview mode", () => {
    const html = renderToStaticMarkup(
      <VennEngineCanvas
        model={buildVennPreset("venn2")}
        selectedRegion={null}
        selectedSet={null}
        onSelectRegion={() => undefined}
        onSelectSet={() => undefined}
        onChange={() => undefined}
        editable={false}
      />,
    );
    expect(html).toContain('data-venn-mode="overview"');
    expect(html).toContain('fill="#3B82F6"');
    expect(html).toContain('fill="#F97316"');
  });
});