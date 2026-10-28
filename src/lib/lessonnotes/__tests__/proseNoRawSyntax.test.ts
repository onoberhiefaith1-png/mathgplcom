// Raw syntax must never reach the page: a backslash command inside a sentence
// becomes a real math object, never literal characters.

import { describe, expect, it } from "vitest";
import { aiTextToNodes } from "../aiToNodes";

const visibleText = (nodes: any[]): string => {
  let out = "";
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === "text") out += n.text ?? "";
    (n.content ?? []).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
};

const mathValues = (nodes: any[]): string[] => {
  const vals: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === "mathInline" || n.type === "mathBlock") vals.push(String(n.attrs?.value ?? ""));
    (n.content ?? []).forEach(walk);
  };
  nodes.forEach(walk);
  return vals;
};

describe("no raw syntax in prose", () => {
  it("turns \\sqrt{2} inside a sentence into a math object", () => {
    const nodes = aiTextToNodes("The conjugate of the denominator is 3 + \\sqrt{2} here.");
    expect(visibleText(nodes)).not.toMatch(/\\/);
    expect(mathValues(nodes).join(" ")).toMatch(/sqrt/);
  });

  it("keeps a pure calculation line as structured math", () => {
    const nodes = aiTextToNodes("1 × (3 - \\sqrt{2})");
    expect(visibleText(nodes)).not.toMatch(/\\/);
    expect(mathValues(nodes).length).toBeGreaterThan(0);
  });

  it("converts \\frac{1}{2} written inside prose", () => {
    const nodes = aiTextToNodes("We multiply the whole expression by \\frac{1}{2} to simplify.");
    expect(visibleText(nodes)).not.toMatch(/\\/);
    expect(mathValues(nodes).join(" ")).toMatch(/frac/);
  });
});
