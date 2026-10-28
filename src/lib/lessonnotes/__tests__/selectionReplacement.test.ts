import { describe, expect, it } from "vitest";
import { lessonAiLeafText, structuredSelectionReplacement } from "../ai/selectionReplacement";
import { aiTextToNodes } from "../aiToNodes";

const parent = { type: "paragraph", attrs: { textAlign: "center" } };
const diagram = { type: "geometryDiagram", attrs: { scene: { objects: [] } } };
const before = [{ type: "text", text: "Before ", marks: [{ type: "bold" }] }];
const after = [{ type: "mathInline", attrs: { value: "x^2" } }];
describe("accepting a diagram over highlighted text", () => {
  it.each([[null, null], [before, null], [null, after], [before, after]])("supports paragraph-boundary fragments without losing surrounding objects", (left, right) => {
    const result = structuredSelectionReplacement(parent, left, [diagram], right);
    expect(result).toEqual([
      ...(left ? [{ ...parent, content: left }] : []), diagram,
      ...(right ? [{ ...parent, content: right }] : []),
    ]);
    expect(result.filter(n => (n as any).type === "geometryDiagram")).toHaveLength(1);
  });
  it("replaces a fully highlighted paragraph with the same native diagram shown in preview", () => {
    const generated = aiTextToNodes('[[tool:diagram type="circle" labels="P,Q,R"]]');
    expect(generated.length).toBeGreaterThan(0);
    expect(structuredSelectionReplacement(parent, null, generated, null)).toEqual(generated);
  });
});
it("section AI reads math atom content instead of treating the section as empty", () => {
  expect(lessonAiLeafText({ attrs: { value: "3x + 7 = 22" } })).toBe("3x + 7 = 22");
  expect(lessonAiLeafText({ attrs: {} })).toBe("\n");
});
