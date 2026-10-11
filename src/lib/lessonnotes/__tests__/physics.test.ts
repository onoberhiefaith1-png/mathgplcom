import { describe, expect, it } from "vitest";
import { findPhysicsSymbol } from "../assets/physics";
import { searchAssets } from "../assets/registry";
import { isPhysicsSubject, resolveSymbolMeaning } from "../../../../supabase/functions/notebook-ai/physicsStandard.ts";
import { chooseVisualKind } from "../../../../supabase/functions/notebook-ai/visualSelectionStandard.ts";
import { subjectKnowledgeBlocks } from "../../../../supabase/functions/notebook-ai/sharedKnowledge.ts";

describe("physics symbol library", () => {
  it("knows force is F in newtons", () => {
    expect(findPhysicsSymbol("F")?.unit).toBe("N");
  });
  it("is searchable from the @ menu", () => {
    expect(searchAssets("density").some((a) => a.id === "ph_rho")).toBe(true);
  });
});

describe("T by topic", () => {
  it("tension in forces", () => expect(resolveSymbolMeaning("T", "Forces and equilibrium")?.meaning).toBe("tension"));
  it("period in waves", () => expect(resolveSymbolMeaning("T", "Waves and sound")?.meaning).toBe("period"));
  it("temperature in gas laws", () => expect(resolveSymbolMeaning("T", "Gas laws")?.meaning).toBe("absolute temperature"));
});

describe("subject gating", () => {
  it("adds nothing for Mathematics", () => {
    expect(subjectKnowledgeBlocks("Mathematics")).toEqual([]);
    expect(subjectKnowledgeBlocks(undefined)).toEqual([]);
  });
  it("adds the Physics standard with units on every line", () => {
    expect(isPhysicsSubject("Physics")).toBe(true);
    expect(subjectKnowledgeBlocks("Physics").join("\n")).toContain("carrying units on every line");
  });
});

describe("visual chooser", () => {
  it("circuit is a diagram", () => expect(chooseVisualKind("series circuit with two resistors")).toBe("diagram"));
  it("velocity-time is a graph", () => expect(chooseVisualKind("velocity-time graph")).toBe("graph"));
  it("vernier is a photo", () => expect(chooseVisualKind("vernier caliper")).toBe("photo"));
});
