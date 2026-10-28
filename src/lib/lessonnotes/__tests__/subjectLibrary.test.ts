import { describe, it, expect } from "vitest";
import { SUBJECTS, alternativeSubjects, getSubject, searchSubject } from "../assets/subjects";
import { CHEMISTRY_ELEMENTS } from "../assets/subjects/chemistry";

describe("multi-subject Asset Library", () => {
  it("has the six subjects in order", () => {
    expect(SUBJECTS.map((s) => s.name)).toEqual(["Mathematics", "Physics", "Chemistry", "Engineering", "Accounting", "Economics"]);
  });
  it("excludes the open subject from its tabs", () => {
    for (const s of SUBJECTS) {
      const alt = alternativeSubjects(s.id);
      expect(alt).toHaveLength(5);
      expect(alt.some((a) => a.id === s.id)).toBe(false);
    }
  });
  it("Physics has all 17 specification sections, none empty", () => {
    const p = getSubject("physics");
    expect(p.sections).toHaveLength(17);
    for (const s of p.sections) expect(s.entries.length).toBeGreaterThan(0);
  });
  it("Chemistry has 118 unique elements ending in Og", () => {
    expect(CHEMISTRY_ELEMENTS).toHaveLength(118);
    expect(new Set(CHEMISTRY_ELEMENTS.map((e) => e.symbol)).size).toBe(118);
    expect(CHEMISTRY_ELEMENTS[117].meaning).toBe("Oganesson");
  });
  it("subjects never share entry ids", () => {
    const ids = (id: "physics" | "chemistry") => new Set(getSubject(id).sections.flatMap((s) => s.entries.map((e) => e.id)));
    const p = ids("physics");
    for (const id of ids("chemistry")) expect(p.has(id)).toBe(false);
  });
  it("search stays inside one subject", () => {
    expect(searchSubject(getSubject("chemistry"), "sulfate").length).toBeGreaterThan(0);
    expect(searchSubject(getSubject("physics"), "sulfate")).toHaveLength(0);
  });
  it("apparatus and hazards are pending, not faked", () => {
    const c = getSubject("chemistry");
    for (const id of ["apparatus", "hazards"]) {
      expect(c.sections.find((s) => s.id === id)!.entries.every((e) => e.status === "pending")).toBe(true);
    }
  });
});
