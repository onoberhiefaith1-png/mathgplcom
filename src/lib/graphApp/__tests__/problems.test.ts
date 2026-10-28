import { describe, it, expect } from "vitest";
import { PROBLEMS, checkAnswer } from "../problems";
const p = (id: string) => PROBLEMS.find(x => x.id === id)!;
describe("Phase 8 real-world problems", () => {
  it("car speed at t=4 is 19", () => expect(p("speed").answer).toBe(19));
  it("water in 6 minutes is 21 litres", () => expect(p("water").answer).toBeCloseTo(21, 6));
  it("fence side is 50", () => expect(p("fence").answer).toBe(50));
  it("adult tickets are 80", () => expect(p("tickets").answer).toBeCloseTo(80, 6));
  it("image area is 5", () => expect(p("image").answer).toBeCloseTo(5, 9));
  it("population factor ≈ 1.2808", () => expect(p("population").answer).toBeCloseTo(1.2808, 3));
  it("accepts rounded answers and rejects wrong ones", () => { expect(checkAnswer(p("population"), "1.28")).toBe(true); expect(checkAnswer(p("speed"), "18")).toBe(false); expect(checkAnswer(p("speed"), "")).toBe(false); });
});
