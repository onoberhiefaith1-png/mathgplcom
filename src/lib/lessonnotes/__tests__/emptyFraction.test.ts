import { describe, expect, it } from "vitest";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { aiTextToNodes, isEmptyMathValue } from "@/lib/lessonnotes/aiToNodes";
import { repairMangledMacros } from "@/lib/lessonnotes/macroRepair";

const walk = (nodes: any[], out: any[] = []): any[] => {
  for (const n of nodes ?? []) {
    out.push(n);
    if (Array.isArray(n?.content)) walk(n.content, out);
  }
  return out;
};

describe("empty fraction bars never reach generated lesson notes", () => {
  it("drops an unreadable fraction in generated mode", () => {
    const gen = assertDisplaySafe("Angle = \\frac", "generated");
    expect(gen.cleaned).not.toContain("\\sl{}");
    expect(gen.cleaned).not.toContain("\\frac");
  });

  it("keeps an editable slot while a teacher is typing", () => {
    const edit = assertDisplaySafe("Angle = \\frac", "editing");
    expect(edit.cleaned).toContain("\\frac{\\sl{}}{\\sl{}}");
  });

  it("recognises empty-only math values", () => {
    expect(isEmptyMathValue("\\frac{\\sl{}}{\\sl{}}")).toBe(true);
    expect(isEmptyMathValue("\\sqrt{\\sl{}}")).toBe(true);
    expect(isEmptyMathValue("\\frac{1}{2}")).toBe(false);
  });

  it("restores a JSON-mangled \\frac instead of showing rac140", () => {
    expect(repairMangledMacros("\frac{140}{2}")).toBe("\\frac{140}{2}");
  });

  it("emits no empty math node for mangled generated text", () => {
    const nodes = aiTextToNodes("Angle = \frac{140}{2}");
    const math = walk(nodes).filter((n) => n.type === "mathBlock" || n.type === "mathInline");
    for (const m of math) expect(isEmptyMathValue(m.attrs?.value ?? "")).toBe(false);
    expect(JSON.stringify(nodes)).not.toContain("rac140");
  });
});
