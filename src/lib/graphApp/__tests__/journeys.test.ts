import { describe, it, expect } from "vitest";
import { JOURNEYS, checkAnswer } from "../journeys";
const j = (id: string, seed = 0) => JOURNEYS.find(x => x.id === id)!.build(seed);
describe("journeys", () => {
  it("lines meet at (3,3)", () => expect(checkAnswer(j("lines")[1], "(3, 3)")).toBe(true));
  it("cube 125/150/5√3", () => { const s = j("cube"); expect(s[0].answer[0]).toBe(125); expect(s[1].answer[0]).toBe(150); expect(s[2].answer[0]).toBeCloseTo(5 * Math.sqrt(3), 5); });
  it("riemann converges to 9", () => { const s = j("riemann"); expect(s[2].answer[0]).toBe(9); expect(Math.abs(s[1].answer[0] - 9)).toBeLessThan(Math.abs(s[0].answer[0] - 9)); });
  it("eigenvalues 3,1", () => expect(j("eigen")[0].answer).toEqual([3, 1]));
  it("wrong answer rejected", () => expect(checkAnswer(j("cube")[0], "124")).toBe(false));
  it("changed numbers change answers", () => { for (const id of ["lines","cube","riemann","eigen"]) expect(j(id, 3)).not.toEqual(j(id)); });
});
