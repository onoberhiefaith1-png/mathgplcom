// Practice (server) vs teacher Test (client) parity for keys the production
// compiler stores with Unicode superscript exponents ("2⁵"). Before the fix the
// server normalize() only knew ² and ³, so "2⁵ = 2×2×2×2×2" vs a correct
// student "2^5 = 2×2×2×2×2" was never "equal" on the server, while the client
// engine (exactEval/verify) maps every superscript digit. SYNTHETIC fixture.
import { describe, expect, it, vi } from "vitest";
vi.mock("npm:mathjs@12", async () => await import("mathjs"));
const { toUnicodeMath } = await import("@/lib/notebook/unicodeMath");
const m = await import("../../../../supabase/functions/_shared/mathEquivalence");

describe("server superscript exponents", () => {
  const key = toUnicodeMath("2^5 = 2×2×2×2×2");
  it("the production compiler stores the exponent as a superscript", () => {
    expect(key).toContain("⁵");
  });
  it.each(["2^5 = 2×2×2×2×2", "(2)^(5) = 2×2×2×2×2", "2^5=2*2*2*2*2", key])("accepts %s", (s) => {
    expect(m.deterministicVerdict(key, s)).toBe("equal");
  });
  it.each(["2^5 = 2×2×2×2", "2^4 = 2×2×2×2×2", "5^2 = 2×2×2×2×2"])("rejects %s", (s) => {
    expect(m.deterministicVerdict(key, s)).not.toBe("equal");
  });
  it("multi-character and signed superscripts", () => {
    expect(m.normalize("x¹⁰")).toBe("x^(10)");
    expect(m.normalize("2⁻³")).toBe("2^(-3)");
    expect(m.normalize("x²")).toBe("x^2");
  });
});
