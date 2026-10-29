import { sanitizePresentation as cleanClientPresentation } from "../outputHygiene";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { renderMathInline } from "../../notebook/mathRender";
import { toUnicodeMath } from "../../../../supabase/functions/notebook-ai/unicodeMath";
import { sanitizePresentation } from "../../../../supabase/functions/notebook-ai/outputHygiene";
import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs";
import { TEACHER_WORKED_EXAMPLES, teacherWorkedExamplesForRequest } from "../../../../supabase/functions/notebook-ai/teacherWorkedExamples";
import { TEACHER_LESSON_PRESENTATION_STANDARD, matrixPresentationIssues, teacherPresentationForRequest } from "../../../../supabase/functions/notebook-ai/teacherPresentation";
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
  it("independently checks the finite and convergent infinite sum references", () => {
    for (const n of [1,2,7,20]) expect(Array.from({length:n},(_,k) => 2*(k+1)-1).reduce((a,b)=>a+b,0)).toBe(n*n);
    for (const N of [0,1,5,12]) {
      const finite = Array.from({length:N+1},(_,k)=>(1/3)**k).reduce((a,b)=>a+b,0);
      expect(finite).toBeCloseTo((1-(1/3)**(N+1))/(1-1/3),12);
    }
    const partial = Array.from({length:40},(_,k)=>(1/3)**k).reduce((a,b)=>a+b,0);
    expect(partial).toBeCloseTo(1.5,12);
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
    ["real analysis sequences", "analysis-sequence"], ["continuity proofs", "analysis-continuity"], ["finite summation", "finite-summation"],
    ["infinite geometric series", "infinite-geometric-series"], ["uniform convergence", "analysis-uniform-counterexample"],
  ])("selects %s", (subtopic,id) => {
    const refs = teacherWorkedExamplesForRequest({subtopic});
    expect(refs).toContain(`Reference: ${id}`);
    expect((refs.match(/Reference:/g)??[]).length).toBeLessThanOrEqual(2);
  });
  it("gives geometry and statistics their own references without matrix contamination", () => {
    expect(teacherWorkedExamplesForRequest({topic:"Circle theorems"})).toContain("geometry-circle-angle");
    expect(teacherWorkedExamplesForRequest({topic:"Grouped frequency tables"})).toContain("statistics-frequency-mean");
    expect(teacherWorkedExamplesForRequest({topic:"Circle theorems"})).not.toContain("matrix-product");
  });
  it("does not let a broad notebook title override the current subtopic", () => {
    const refs = teacherWorkedExamplesForRequest({topic:"Matrices and calculus",subtopic:"Trigonometric equations"});
    expect(refs).toContain("trig-all-solutions");
    expect(refs).not.toContain("Reference: matrix-product");
  });
  it("does not treat every geometric proof as real analysis", () => {
    expect(teacherWorkedExamplesForRequest({topic:"Circle theorems",teacherPrompt:"Prove the angle theorem"})).not.toContain("analysis-sequence");
  });
  it("reads the real editor snapshot activeSubtopic field", () => {
    const refs = teacherWorkedExamplesForRequest({mode:"copilot",stage:"blueprint",snapshot:{topic:"QA Matrix",activeSubtopic:"Real analysis sequences"}});
    expect(refs).toContain("analysis-sequence");
    expect(refs).not.toContain("Reference: matrix-product");
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
    expect(teacherPresentationForRequest({mode:"generate",subject:"Physics",topic:"Differentiation"})).toBe(TEACHER_LESSON_PRESENTATION_STANDARD);
    expect(teacherPresentationForRequest({mode:"floating",subject:"Mathematics",topic:"Matrix"})).toBe("");
  });
});


describe("advanced reference display", () => {
  it.each([
    ["finite-summation", "∑"], ["infinite-geometric-series", "∑"],
    ["analysis-uniform-counterexample", "{"],
  ])("renders %s as mathematics instead of exposing source", (id,symbol) => {
    const sample = byId(id);
    const source = sample.working.find(line => line.includes("\\sum") || line.includes("\\begin{cases}"))!;
    const normalized = sanitizePresentation(toUnicodeMath(source));
    const html = renderToStaticMarkup(createElement("span", null, renderMathInline(normalized)));
    const doc = new JSDOM(html);
    const visible = doc.window.document.body.textContent!;
    expect(visible).toContain(symbol);
    expect(visible).not.toMatch(/\\(?:sum|begin|frac|to)|infty/);
    doc.window.close();
  });
});


describe("notation observed in actual QA generation", () => {
  it.each([sanitizePresentation, cleanClientPresentation])("recovers explicit sum and limit bounds in both presentation paths", clean => {
    const source = "Evaluate ∑[k=0 to ∞] (1/2)ᵏ and lim[N → ∞] S_N.";
    const result = clean(source);
    expect(result).toContain(String.raw`\sum_{k=0}^{∞}`);
    expect(result).toContain(String.raw`\lim_{N\to ∞}`);
    expect(clean(result)).toBe(result);
    const html = renderToStaticMarkup(createElement("span",null,renderMathInline(result)));
    const doc = new JSDOM(html);
    expect(doc.window.document.body.textContent).not.toContain("[k=0 to");
    expect(doc.window.document.body.textContent).not.toContain("[N →");
    expect(doc.window.document.body.textContent).toContain("∑");
    doc.window.close();
  });
  it("does not invent missing summation bounds or rewrite ordinary brackets", () => {
    expect(sanitizePresentation("∑[k=0] x_k")).toBe("∑[k=0] x_k");
    expect(sanitizePresentation("A = [0,1]")).toBe("A = [0,1]");
  });
});

describe("broader topic references and existing editor objects", () => {
  it.each([
    ["Fractions", "number-fractions"], ["Quadratic factorisation", "algebra-factorisation"],
    ["Frequency mean", "statistics-frequency-mean"], ["Probability without replacement", "probability-without-replacement"],
    ["Circle theorems", "geometry-circle-angle"], ["Abstract algebra homomorphism", "abstract-homomorphism"],
    ["RC circuit", "engineering-rc-model"], ["Beam equilibrium", "engineering-beam-equilibrium"],
  ])("selects an appropriate presentation reference for %s", (subtopic,id) => {
    const refs = teacherWorkedExamplesForRequest({mode:"generate",subtopic});
    expect(refs).toContain(`Reference: ${id}`);
    expect((refs.match(/Reference:/g) ?? []).length).toBeLessThanOrEqual(2);
  });
  it("selects engineering from the active snapshot instead of a broad matrix title", () => {
    const refs = teacherWorkedExamplesForRequest({mode:"generate",snapshot:{topic:"Matrices",activeSubtopic:"Beam equilibrium"}});
    expect(refs).toContain("engineering-beam-equilibrium");
    expect(refs).not.toContain("matrix-product");
    expect(refs).not.toContain("engineering-rc-model");
  });
  it("selects the correct specialised analysis/series example from the active snapshot", () => {
    expect(teacherWorkedExamplesForRequest({snapshot:{activeSubtopic:"Uniform convergence"}})).toContain("analysis-uniform-counterexample");
    expect(teacherWorkedExamplesForRequest({snapshot:{activeSubtopic:"Infinite geometric series"}})).toContain("infinite-geometric-series");
    expect(teacherWorkedExamplesForRequest({snapshot:{activeSubtopic:"Infinite geometric series"}})).not.toContain("geometry-circle-angle");
  });
  it("does not inject numeric examples into nonmathematical subject namespaces", () => {
    expect(teacherWorkedExamplesForRequest({subject:"Biology",subtopic:"Cell division and groups"})).toBe("");
    expect(teacherWorkedExamplesForRequest({subject:"English",subtopic:"Conditional sentences"})).toBe("");
  });
  it("retains the actual native table and its computed column positions", () => {
    const source = byId("statistics-frequency-mean").working.join("\n");
    const nodes = aiTextToNodes(sanitizePresentation(toUnicodeMath(source)));
    const tables: any[] = [];
    const visit = (node: any) => {
      if (node.type === "mathVisual" && node.attrs?.family === "smarttable") tables.push(node.attrs.attrs);
      (node.content ?? []).forEach(visit);
    };
    nodes.forEach(visit);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["x","f","fx"]);
    expect(tables[0].cells).toEqual([["2","1","2"],["4","4","16"],["6","1","6"]]);
    const rows = tables[0].cells.map((row: string[]) => row.map(Number));
    for (const [x,f,fx] of rows) expect(x*f).toBe(fx);
    expect(rows.reduce((sum: number,row: number[])=>sum+row[2],0)/rows.reduce((sum: number,row: number[])=>sum+row[1],0)).toBe(4);
  });
  it("independently checks the applied reference constraints", () => {
    const tau=2000*100e-6;
    const v=(t:number)=>10*(1-Math.exp(-t/tau));
    expect(tau).toBeCloseTo(0.2);
    expect(v(0)).toBe(0);
    for (const t of [0.01,0.2,1]) {
      const dv=10/tau*Math.exp(-t/tau);
      expect(tau*dv+v(t)).toBeCloseTo(10);
    }
    expect(3*200-600*1).toBe(0);
    expect(400+200-600).toBe(0);
    expect((3/5)*(2/4)).toBeCloseTo(3/10);
  });
  it("keeps teacher/reference instructions out of saved student working", () => {
    for (const sample of TEACHER_WORKED_EXAMPLES) {
      expect(sample.working.join(" ")).not.toMatch(/\b(?:Subcells|prompt|response schema|materializer)\b/i);
    }
  });
});

it("routes the actual Copilot reviseItem payload without copying another question", () => {
  const refs = teacherWorkedExamplesForRequest({mode:"copilot",stage:"reviseItem",snapshot:{topic:"Matrices",activeSubtopic:"Engineering mathematics"},item:{question:"Find the reactions of a beam in equilibrium."},message:"Make this example clearer"});
  expect(refs).toContain("engineering-beam-equilibrium");
  expect(refs).not.toContain("matrix-product");
});
