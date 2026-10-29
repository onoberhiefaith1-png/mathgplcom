import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs";
import { TEACHER_WORKED_EXAMPLES, teacherWorkedExamplesForRequest } from "../../../../supabase/functions/notebook-ai/teacherWorkedExamples";
import { matrixPresentationIssues, teacherPresentationForRequest } from "../../../../supabase/functions/notebook-ai/teacherPresentation";
import { checkSolution } from "../../agent/solutionContract";
import { cleanNoteLines } from "../../agent/noteHygiene";
import { aiTextToNodes } from "../aiToNodes";

const byId = (id: string) => TEACHER_WORKED_EXAMPLES.find(sample => sample.id === id)!;

describe("reviewed few-shot examples", () => {
  it.each(TEACHER_WORKED_EXAMPLES.map(s => [s.id, s] as const))("%s survives the actual plugin save contract", (_id, sample) => {
    const text = [sample.question, ...sample.working].join("\n");
    expect(matrixPresentationIssues(text)).toEqual([]);
    expect(checkSolution(sample.question, cleanNoteLines(text))).toBeNull();
    expect(aiTextToNodes(text).length).toBeGreaterThan(0);
  });
  it("independently evaluates every cell of the matrix working", () => {
    const sample = byId("matrix-product");
    const matrixLines = sample.working.filter(s => s.startsWith("[[tool:structure"));
    const slotValues = (s: string) => /slots="([^"]*)"/.exec(s)![1].split("|").map(x => x.trim());
    const computed = slotValues(matrixLines[0]).map(value => evaluate(value.replaceAll("×", "*")));
    expect(computed).toEqual([1,2,2,4,0,5,7,1,8]);
    expect(slotValues(matrixLines[1]).map(Number)).toEqual(computed);
  });
  it("checks the trig solution set independently over the prescribed interval", () => {
    const roots = [0,60,180,300];
    const rad = (degrees: number) => degrees*Math.PI/180;
    for (const angle of roots) expect(Math.abs(Math.sin(2*rad(angle))-Math.sin(rad(angle)))).toBeLessThan(1e-12);
    // Factoring yields sin(theta)=0 or cos(theta)=1/2; both families are included.
    expect(byId("trig-all-solutions").working.at(-1)).toBe("θ ∈ {0°, 60°, 180°, 300°}");
  });
  it("checks the chain derivative numerically at nontrivial sample values", () => {
    const f = (x: number) => (3*x*x+1)**4;
    for (const x of [-0.7,0.2,1.1]) {
      const h = 1e-6;
      const numerical = (f(x+h)-f(x-h))/(2*h);
      const formula = 24*x*(3*x*x+1)**3;
      expect(Math.abs(numerical-formula)).toBeLessThan(Math.max(1,Math.abs(formula))*1e-8);
    }
  });
  it("checks the definite integral against exact polynomial evaluation", () => {
    const F = (x: number) => x**3;
    expect(F(1)-F(0)).toBe(1);
    expect(byId("calculus-bounds").working.at(-1)).toContain("= 1");
  });
});

describe("relevant sample selection", () => {
  it.each([
    ["matrix multiplication", "matrix-product"], ["trigonometric equations", "trig-all-solutions"],
    ["chain rule differentiation", "calculus-chain-rule"], ["definite integration", "calculus-bounds"],
    ["real analysis sequences", "analysis-sequence"], ["continuity proofs", "analysis-continuity"],
  ])("selects %s", (subtopic,id) => {
    const refs = teacherWorkedExamplesForRequest({subtopic});
    expect(refs).toContain(`Reference: ${id}`);
    expect((refs.match(/Reference:/g)??[]).length).toBeLessThanOrEqual(2);
  });
  it("does not inject irrelevant samples into geometry or statistics", () => {
    expect(teacherWorkedExamplesForRequest({topic:"Circle theorems"})).toBe("");
    expect(teacherWorkedExamplesForRequest({topic:"Grouped frequency tables"})).toBe("");
  });
  it("does not let a broad notebook title override the current subtopic", () => {
    const refs = teacherWorkedExamplesForRequest({topic:"Matrices and calculus",subtopic:"Trigonometric equations"});
    expect(refs).toContain("trig-all-solutions");
    expect(refs).not.toContain("Reference: matrix-product");
  });
  it("does not treat every geometric proof as real analysis", () => {
    expect(teacherWorkedExamplesForRequest({topic:"Circle theorems",teacherPrompt:"Prove the angle theorem"})).toBe("");
  });
  it("keeps incidental negative references out of the topic selection", () => {
    const refs = teacherWorkedExamplesForRequest({subtopic:"Trigonometric equations",teacherPrompt:"Do not copy matrix content from another subtopic"});
    expect(refs).toContain("trig-all-solutions");
    expect(refs).not.toContain("Reference: matrix-product");
  });
  it("does not spend example context on Copilot greetings", () => {
    expect(teacherWorkedExamplesForRequest({mode:"copilot",stage:"greet",subtopic:"Matrix multiplication"})).toBe("");
    expect(teacherWorkedExamplesForRequest({mode:"copilot",stage:"blueprint",material:{text:"Matrix multiplication"}})).toContain("matrix-product");
  });
  it("does not inject Maths examples into other subjects or floating extraction", () => {
    expect(teacherPresentationForRequest({mode:"generate",subject:"Physics",topic:"Differentiation"})).toBe("");
    expect(teacherPresentationForRequest({mode:"floating",subject:"Mathematics",topic:"Matrix"})).toBe("");
  });
});
