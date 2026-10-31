import { describe, expect, it } from "vitest";
import { captureAiSectionTarget, resolveAiSectionTarget, readAiHeadingBody } from "../aiSectionTarget";
const heading = (attrs: Record<string, unknown> = {}) => ({type:{name:"heading"},attrs});
const document = (entries: Array<[number, ReturnType<typeof heading>]>) => ({
  nodeAt: (position: number) => entries.find(([p]) => p === position)?.[1] ?? null,
  descendants: (visit: (node: ReturnType<typeof heading>,position:number) => unknown) => { for (const [position,node] of entries) visit(node,position); },
});
describe("asynchronous section target ownership", () => {
  it("follows the same Solution after earlier content changes its position", () => {
    const before = document([[10,heading({sectionId:"q1"})],[30,heading({ownerQuestionId:"q1"})],[60,heading({sectionId:"q2"})],[90,heading({ownerQuestionId:"q2"})]]);
    const target = captureAiSectionTarget(before,90)!;
    const after = document([[10,heading({sectionId:"q1"})],[30,heading({ownerQuestionId:"q1"})],[160,heading({sectionId:"q2"})],[190,heading({ownerQuestionId:"q2"})]]);
    expect(resolveAiSectionTarget(after,target)).toBe(190);
    expect(after.nodeAt(90)).toBeNull();
  });
  it("follows the section ID even when normalization replaces node instances", () => {
    const target = captureAiSectionTarget(document([[40,heading({sectionId:"q2"})]]),40)!;
    expect(resolveAiSectionTarget(document([[120,heading({sectionId:"q2"})]]),target)).toBe(120);
  });
  it("refuses a deleted target rather than using the next question or caret", () => {
    const target = captureAiSectionTarget(document([[90,heading({ownerQuestionId:"q2"})]]),90)!;
    expect(resolveAiSectionTarget(document([[90,heading({ownerQuestionId:"q3"})]]),target)).toBeNull();
  });
  it("refuses duplicate ownership rather than choosing whichever comes first", () => {
    const target = captureAiSectionTarget(document([[10,heading({ownerQuestionId:"q1"})]]),10)!;
    expect(resolveAiSectionTarget(document([[10,heading({ownerQuestionId:"q1"})],[30,heading({ownerQuestionId:"q1"})]]),target)).toBeNull();
  });
  it("uses immutable identity only for old headings without IDs", () => {
    const old = heading();
    const target = captureAiSectionTarget(document([[10,old]]),10)!;
    expect(resolveAiSectionTarget(document([[50,old]]),target)).toBe(50);
    expect(resolveAiSectionTarget(document([[10,heading()]]),target)).toBeNull();
  });
});

it("does not report an empty Solution heading as existing worked content", () => {
  const node = {...heading({ownerQuestionId:"q1"}),nodeSize:12};
  const doc = document([[20,node]]);
  expect(readAiHeadingBody(doc,20,40,(from,to) => from===32 && to===40 ? "   " : "Solution 1")).toBe("");
  expect(readAiHeadingBody(doc,20,40,(from,to) => from===32 && to===40 ? "x = 4" : "Solution 1")).toBe("x = 4");
  expect(readAiHeadingBody(doc,20,32,()=>"Solution 1")).toBe("");
});
