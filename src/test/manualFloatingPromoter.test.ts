import { describe, it, expect } from "vitest";
import { promoteSelection } from "@/lib/smartboard/manualFloatingPromoter";

describe("promoteSelection", () => {
  it("attaches an empty exponent when ^ follows the highlight", () => {
    const r = promoteSelection("2", "", "^{x+5}");
    expect(r.payload).toBe("2^{□}");
    expect(r.shell).toBe("power");
  });

  it("attaches an empty subscript when _ follows the highlight", () => {
    const r = promoteSelection("a", "", "_{i+1}");
    expect(r.payload).toBe("a_{□}");
    expect(r.shell).toBe("subscript");
  });

  it("attaches a bracket when ( follows a single-letter function", () => {
    const r = promoteSelection("f", "", "(x)");
    expect(r.payload).toBe("f(□)");
    expect(r.shell).toBe("bracket");
  });

  it("attaches a bracket when ( follows a Greek symbol", () => {
    const r = promoteSelection("θ", "", "(x+2y)");
    expect(r.payload).toBe("θ(□)");
  });

  it("leaves a fully-highlighted f(x) chip verbatim", () => {
    const r = promoteSelection("f(x)", "", " =");
    expect(r.payload).toBe("f(x)");
    expect(r.shell).toBeUndefined();
  });

  it("leaves a fully-highlighted 2^{x+5} chip verbatim", () => {
    const r = promoteSelection("2^{x+5}", "", " =");
    expect(r.payload).toBe("2^{x+5}");
    expect(r.shell).toBeUndefined();
  });

  it("attaches sin( bracket for trig highlight", () => {
    const r = promoteSelection("sin", "", " (x)");
    expect(r.payload).toBe("sin(□)");
    expect(r.shell).toBe("function");
  });

  it("attaches sin^{□}(□) when sin is followed by ^", () => {
    const r = promoteSelection("sin", "", "^{2}(x)");
    expect(r.payload).toBe("sin^{□}(□)");
    expect(r.shell).toBe("power");
  });

  it("attaches log_{□}(□) when log is followed by _ then (", () => {
    const r = promoteSelection("log", "", "_{2}(x)");
    expect(r.payload).toBe("log_{□}(□)");
    expect(r.shell).toBe("log");
  });

  it("attaches the absolute-value shell when flanked by |", () => {
    const r = promoteSelection("x+1", "|", "|");
    expect(r.payload).toBe("|x+1|");
    expect(r.shell).toBe("absolute");
  });

  it("turns lone √ into √(□)", () => {
    const r = promoteSelection("√", "", "{x+1}");
    expect(r.payload).toBe("√(□)");
    expect(r.shell).toBe("radical");
  });

  it("turns lone ∫ into ∫□ d□", () => {
    const r = promoteSelection("∫", "", " x dx");
    expect(r.payload).toBe("∫□ d□");
    expect(r.shell).toBe("integral");
  });

  it("turns d/dx into d/dx(□)", () => {
    const r = promoteSelection("d/dx", "", "(x²+1)");
    expect(r.payload).toBe("d/dx(□)");
    expect(r.shell).toBe("derivative");
  });

  it("turns lim into lim_{□}(□)", () => {
    const r = promoteSelection("lim", "", "_{x→0} f(x)");
    expect(r.payload).toBe("lim_{□}(□)");
    expect(r.shell).toBe("limit");
  });

  it("returns text verbatim when no structure is adjacent", () => {
    const r = promoteSelection("let", "", " x = 2");
    expect(r.payload).toBe("let");
    expect(r.shell).toBeUndefined();
  });

  it("ignores already-present own power", () => {
    const r = promoteSelection("x^{2}", "", "^{3}");
    expect(r.payload).toBe("x^{2}");
  });
});
