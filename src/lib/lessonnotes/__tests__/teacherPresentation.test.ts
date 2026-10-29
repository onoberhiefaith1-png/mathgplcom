import { describe, expect, it } from "vitest";
import { normalizeMatrixDirectives } from "../../../../supabase/functions/notebook-ai/matrixPresentation";
import { toUnicodeMath as serverMath } from "../../../../supabase/functions/notebook-ai/unicodeMath";
import { sanitizePresentation as serverClean } from "../../../../supabase/functions/notebook-ai/outputHygiene";
import { TEACHER_LESSON_PRESENTATION_STANDARD, TEACHER_PRESENTATION_STANDARD, teacherPresentationForRequest, matrixPresentationIssues } from "../../../../supabase/functions/notebook-ai/teacherPresentation";
import { sanitizePresentation as clientClean } from "../outputHygiene";
import { aiTextToNodes } from "../aiToNodes";
import { subjectKnowledgeBlocks } from "../../../../supabase/functions/notebook-ai/sharedKnowledge";

const matrices = (nodes: any[]): any[] => nodes.flatMap((node) => [
  ...(node.type === "mathStructure" && node.attrs?.kind === "matrix" ? [node] : []),
  ...matrices(node.content ?? []),
]);
const cells = (node: any) => node.content.map((s: any) => s.content?.map((t: any) => t.text).join("") ?? "");

describe("server-to-editor matrix integrity", () => {
  it.each([
    [2, 2, "1 & 2 \\\\ 3 & 4", ["1", "2", "3", "4"]],
    [3, 3, "1 & 2 & 0 \\\\ 2 & 0 & 1 \\\\ 3 & 1 & 2", ["1", "2", "0", "2", "0", "1", "3", "1", "2"]],
    [2, 3, "1 & 0 & 2 \\\\ 3 & 4 & 5", ["1", "0", "2", "3", "4", "5"]],
    [1, 7, "1 & 2 & 3 & 4 & 5 & 6 & 7", ["1", "2", "3", "4", "5", "6", "7"]],
  ])("retains %i by %i dimensions after the real server and client passes", (rows, cols, body, expected) => {
    const source = `A = \\begin{bmatrix}${body}\\end{bmatrix}`;
    const normalized = serverClean(serverMath(source));
    expect(serverMath(normalized)).toBe(normalized);
    const [matrix] = matrices(aiTextToNodes(normalized));
    expect(matrix.attrs.attrs).toEqual({ rows, cols, br: "[" });
    expect(cells(matrix)).toEqual(expected);
  });

  it("keeps nine visible dot products in a single working matrix", () => {
    const a = [[1,2,0],[2,0,1],[3,1,2]], b = [[0,1,1],[1,3,2],[5,2,0]];
    const dot = a.flatMap(row => b[0].map((_, j) => row.map((v,k) => `${v}×${b[k][j]}`).join(" + ")));
    const result = a.flatMap(row => b[0].map((_,j) => row.reduce((sum,v,k) => sum+v*b[k][j],0)));
    expect(result).toEqual([2,7,5,5,4,2,11,10,5]);
    const directive = (slots: string[]) => `[[tool:structure kind="matrix" rows="3" cols="3" bracket="square" slots="${slots.join(" | ")}"]]`;
    const doc = aiTextToNodes(serverClean(serverMath(`AB =\n${directive(dot)}\n=\n${directive(result.map(String))}`)));
    const ms = matrices(doc);
    expect(ms).toHaveLength(2);
    expect(cells(ms[0])).toEqual(dot);
    expect(cells(ms[1])).toEqual(result.map(String));
  });

  it("does not shift coordinates when the first, middle or last slot is blank", () => {
    const source = '[[tool:structure kind="matrix" rows="2" cols="3" slots=" | 2 | | 4 | 0 | "]]';
    const [matrix] = matrices(aiTextToNodes(source));
    expect(cells(matrix)).toEqual(["", "2", "", "4", "0", ""]);
  });

  it("retains fractions and powers inside matrix cells", () => {
    const src = String.raw`\begin{bmatrix}\frac{1}{2} & x^{2} \\ 0 & -3\end{bmatrix}`;
    const [matrix] = matrices(aiTextToNodes(serverClean(serverMath(src))));
    expect(matrix.attrs.attrs.rows).toBe(2);
    expect(cells(matrix)[0]).toBe(String.raw`\frac{1}{2}`);
    expect(cells(matrix)[1]).toBe("x²");
    expect(cells(matrix)[3]).toBe("-3");
  });
});

describe("teacher presentation request boundaries", () => {
  it.each(["copilot", "mathengine", "generate", "solve_with_reasoning", "edit", "blueprint", "review", "verify"])("applies to Maths %s", mode => {
    expect(teacherPresentationForRequest({ mode, subject: "Mathematics" })).toBe(`${TEACHER_LESSON_PRESENTATION_STANDARD}\n\n${TEACHER_PRESENTATION_STANDARD}`);
  });
  it.each(["floating", "floating_highlights", "floating_line_edit", "geometry", "scan", "table_edit"])("does not change %s protocols", mode => {
    expect(teacherPresentationForRequest({ mode })).toBe("");
  });
  it.each(["Physics", "Chemistry", "English"])("adds only the shared editorial envelope for %s", subject => {
    expect(teacherPresentationForRequest({mode:"generate",subject})).toBe(TEACHER_LESSON_PRESENTATION_STANDARD);
  });
  it("resolves the nested subject before using the Maths default", () => {
    expect(teacherPresentationForRequest({mode:"edit",snapshot:{subject:"Physics"}})).toBe(TEACHER_LESSON_PRESENTATION_STANDARD);
    expect(teacherPresentationForRequest({mode:"mathengine"})).toBe(`${TEACHER_LESSON_PRESENTATION_STANDARD}\n\n${TEACHER_PRESENTATION_STANDARD}`);
    expect(subjectKnowledgeBlocks("Chemistry").join(" ")).toContain("CHEMISTRY");
    expect(subjectKnowledgeBlocks("Physics").join(" ")).toContain("PHYSICS");
  });
});


describe("matrix pre-save checks", () => {
  it("refuses a 3 by 3 declaration with seven cells", () => {
    expect(matrixPresentationIssues('[[tool:structure kind="matrix" rows="3" cols="3" slots="1 | 2 | 0 2 | 0 | 1 3 | 1 | 2"]]')[0]).toContain("needs 9 slots");
  });
  it("accepts legitimate row vectors and blank cells", () => {
    expect(matrixPresentationIssues('[[tool:structure kind="matrix" rows="1" cols="3" slots=" | 0 | "]]')).toEqual([]);
  });
  it("refuses missing dimensions and ragged legacy matrices", () => {
    expect(matrixPresentationIssues('[[tool:structure kind="matrix" slots="1 | 2"]]')).toHaveLength(1);
    expect(matrixPresentationIssues(String.raw`\begin{bmatrix}1 & 2 \\ 3\end{bmatrix}`)).toHaveLength(1);
  });
  it("does not reject legitimate general indexed mathematics", () => {
    expect(matrixPresentationIssues(String.raw`c_{ij} = \sum_{k=1}^{n} a_{ik}b_{kj}`)).toEqual([]);
  });
});


describe("advanced notation survives presentation hygiene", () => {
  it.each([
    String.raw`\theta + \tan x`,
    String.raw`\lim_{n\to\infty} \frac{1}{n} = 0`,
    String.raw`\sum_{n=1}^{\infty} \frac{1}{n^{2}}`,
    String.raw`\int_{0}^{1} x^{2} dx`,
    String.raw`\forall \epsilon > 0, \norm{x-a} < \delta`,
  ])("preserves command boundaries in %s", source => {
    expect(serverClean(source)).toBe(source);
    expect(clientClean(source)).toBe(source);
    const normalized = serverClean(serverMath(source));
    expect(normalized).not.toMatch(/\b(?:heta|abla|orm|ext)\b/);
    expect(normalized).not.toContain("\no");
  });
  it("still decodes standalone escaped line breaks and tabs", () => {
    for (const clean of [serverClean, clientClean]) {
      expect(clean(String.raw`first\n second\t third`)).toBe("first\n second   third");
    }
  });
});


describe("direct-UI baseline failures", () => {
  it("normalizes the actual generated question without changing any matrix entry", () => {
    const raw = 'Given matrix A = [matrix rows="2" cols="2" bracket="square" slots="2 | 1 | 0 | 3"] and matrix B = [matrix rows="2" cols="2" bracket="square" slots="1 | 4 | 2 | 0"], find the product AB.';
    const clean = serverClean(raw);
    expect(normalizeMatrixDirectives(clean)).toBe(clean);
    expect(matrixPresentationIssues(clean)).toEqual([]);
    const ms = matrices(aiTextToNodes(clean));
    expect(ms.map(cells)).toEqual([["2","1","0","3"],["1","4","2","0"]]);
    expect(ms.map(m => m.attrs.attrs)).toEqual([{rows:2,cols:2,br:"["},{rows:2,cols:2,br:"["}]);
    expect(clean).toContain("find the product AB.");
  });
  it("preserves the real result as a 2 by 2 matrix through server conversion", () => {
    const raw = String.raw`AB = \begin{pmatrix}4 & 8 \\ 6 & 0\end{pmatrix}`;
    const [matrix] = matrices(aiTextToNodes(serverClean(serverMath(raw))));
    expect(matrix.attrs.attrs).toEqual({rows:2,cols:2,br:"("});
    expect(cells(matrix)).toEqual(["4","8","6","0"]);
  });
  it("does not guess missing dimensions or silently fill missing values", () => {
    const invalid = '[matrix rows="3" cols="3" slots="1 | 2 | 0 2 | 0 | 1 3 | 1 | 2"]';
    expect(normalizeMatrixDirectives(invalid)).toBe(invalid);
    expect(matrixPresentationIssues(invalid)).toHaveLength(1);
  });
});

describe("cross-subject teacher presentation", () => {
  it.each(["Statistics", "Geometry", "Abstract Mathematics", "Abstract Algebra", "Engineering Mathematics"])("recognises %s as mathematics rather than silently dropping its rules", subject => {
    const guidance = teacherPresentationForRequest({mode:"generate",subject});
    expect(guidance).toContain("TEACHER-READY LESSON PRESENTATION — ALL SUBJECTS");
    expect(guidance).toContain("TEACHER-READY MATHEMATICS");
  });
  it.each(["Physics", "Chemistry", "English", "Biology", "History"])("keeps %s subject standards and diagrams independent", subject => {
    const guidance = teacherPresentationForRequest({mode:"generate",subject,subtopic:"Groups, geometry and derivatives"});
    expect(guidance).toBe(TEACHER_LESSON_PRESENTATION_STANDARD);
    expect(guidance).not.toContain("Reference:");
  });
  it("adds applied presentation to engineering maths and engineering subjects", () => {
    for (const body of [
      {subject:"Engineering Mathematics",subtopic:"RC circuit"},
      {subject:"Mechanical Engineering",subtopic:"Beam equilibrium"},
      {subject:"Mathematics",snapshot:{activeSubtopic:"RC circuit model"}},
    ]) {
      const guidance = teacherPresentationForRequest({mode:"generate",...body});
      expect(guidance).toContain("ENGINEERING TEACHING PRESENTATION");
      expect(guidance).toContain("Reference: engineering-");
      expect(guidance).not.toContain("Reference: matrix-product");
    }
  });
  it("supports an unfamiliar lesson topic without inventing a reference example", () => {
    const guidance = teacherPresentationForRequest({mode:"generate",subject:"Mathematics",subtopic:"An unfamiliar advanced topic"});
    expect(guidance).toContain("TEACHER-READY LESSON PRESENTATION");
    expect(guidance).not.toContain("Reference:");
  });
  it.each(["floating", "floating_highlights", "table_edit", "geometry", "scan"])("does not change %s payload schemas even for engineering", mode => {
    expect(teacherPresentationForRequest({mode,subject:"Engineering",topic:"RC circuit"})).toBe("");
  });
});
