// The marking service's deterministic verdict for the reported lesson lines.
// (The service runs on Deno; here its module is loaded with Node's mathjs.)
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("npm:mathjs@12", async () => await import("mathjs"));
// Loaded by path at run time so the app's typecheck never walks into Deno code.
const SERVICE = "../../../../supabase/functions/_shared/mathEquivalence";
let deterministicVerdict: (teacher: string, student: string) => string;
beforeAll(async () => {
  ({ deterministicVerdict } = await import(/* @vite-ignore */ SERVICE));
});

describe("marking service: LaTeX keys and board Unicode are the same line", () => {
  const equal: [string, string][] = [
    ["\\Sigma x=3+5+6+9+7", "Σx=3 +5 +6 +9 +7"],
    ["\\sum x = 30", "Σx=30"],
    ["\\mu=\\frac{\\Sigma x}{N}", "μ=Σx/N"],
    ["\\mu=\\frac{30}{5}", "μ=30/5"],
    ["\\mu=6\\text{cm}", "μ = 6 cm"],
    ["(x-\\bar{x})^2", "(x−x̄)²"],
    ["Σx=30", "Σx = 30"],
    ["μ=6cm", "μ=6cm"],
  ];
  for (const [key, student] of equal) {
    it(`${key} ≡ ${student}`, () => expect(deterministicVerdict(key, student)).toBe("equal"));
  }
  it("still rejects a missing unit and a wrong total", () => {
    expect(deterministicVerdict("\\mu=6\\text{cm}", "μ=6")).toBe("not_equal");
    expect(deterministicVerdict("\\Sigma x=30", "Σx=31")).toBe("not_equal");
  });
});
