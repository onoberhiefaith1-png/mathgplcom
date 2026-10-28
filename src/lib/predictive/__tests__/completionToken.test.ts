import { describe, expect, it } from "vitest";
import { isPreEvaluated, predict, provesEquivalent, routeMapFor, setEquivalent } from "../predictiveLine";

describe("set-aware equivalence", () => {
  it("accepts swapped sides and reordered members", () => {
    expect(setEquivalent("A = {1,2,3}", "{1,2,3} = A")).toBe(true);
    expect(provesEquivalent("A = {1,2,3}", "A = {3, 1, 2}")).toBe(true);
    expect(provesEquivalent("A = {1,2,3}", "A = {1,2,4}")).toBe(false);
  });
});

describe("Completion Token + pre-evaluation", () => {
  const map = routeMapFor({ expectedAscii: "x = 5", atoms: ["x", "=", "5"], keyPrefix: "ct" });

  it("names the final piece of the current route", () => {
    const p = predict({ routeMap: map, studentAscii: "x =" });
    expect(p.status).toBe("incomplete");
    expect(p.completionToken).toBe("5");
    expect(isPreEvaluated(map.key, p.predictive)).toBe(true);
  });

  it("confirms instantly when the token is placed", () => {
    const p = predict({ routeMap: map, studentAscii: "x = 5" });
    expect(p.complete).toBe(true);
  });

  it("accepts a rearranged route", () => {
    expect(predict({ routeMap: map, studentAscii: "5 = x" }).complete).toBe(true);
  });
});
