// Math Lab console — a MATLAB-style command line, computed on the device
// (no AI, no credits). Independent of the Lesson Note / Smartboard graph.
import { create, all, type MathJsInstance } from "mathjs";
import { normalise } from "./math";

export type ConsoleEntry =
  | { type: "in"; text: string }
  | { type: "out"; text: string }
  | { type: "err"; text: string }
  | { type: "plot"; src: string };

export interface ConsoleResult {
  entries: ConsoleEntry[];
  /** Set when the command asks to plot an equation in the main canvas. */
  plot?: string;
}

export interface LabConsole {
  run(input: string): ConsoleResult;
  reset(): void;
  names(): string[];
}

const math: MathJsInstance = create(all);

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6);
  }
  // Matrices and everything else: mathjs string form
  return math.format(v, { precision: 8 });
}

/** Translate teacher-friendly symbols and MATLAB-style matrices to mathjs. */
function toMathJs(src: string): string {
  // MATLAB writes [1 2; 3 4]; mathjs v15 needs commas: [1, 2; 3, 4]
  const withCommas = src.replace(/\[([^\]]*)\]/g, (_m, inner: string) =>
    "[" + inner.split(";").map((row) => row.trim().split(/\s+/).filter(Boolean).join(", ")).join("; ") + "]");
  return normalise(withCommas).replace(/LOG10\(/g, "log10(");
}

export function createLabConsole(): LabConsole {
  let scope: Record<string, unknown> = {};

  const evaluate = (expr: string): unknown => math.evaluate(toMathJs(expr), scope);

  const run = (raw: string): ConsoleResult => {
    const input = raw.trim();
    const entries: ConsoleEntry[] = [{ type: "in", text: input }];
    if (!input) return { entries: [] };

    try {
      // Built-in commands -------------------------------------------------
      if (/^(clc|clear\s+screen)$/i.test(input)) return { entries: [] };
      if (/^clear$/i.test(input)) {
        scope = {};
        entries.push({ type: "out", text: "Workspace cleared" });
        return { entries };
      }
      if (/^(who|whos)$/i.test(input)) {
        const ns = Object.keys(scope);
        entries.push({ type: "out", text: ns.length ? ns.join("   ") : "(empty workspace)" });
        return { entries };
      }
      if (/^help$/i.test(input)) {
        entries.push({
          type: "out",
          text:
            "Commands: A = [1 2; 3 4] · det(A) · inv(A) · A*B · x = 2+3 · disp(x) · " +
            "plot y = x^2 · who · clear · clc",
        });
        return { entries };
      }

      const disp = input.match(/^disp\((.+)\)$/i);
      if (disp) {
        entries.push({ type: "out", text: formatValue(evaluate(disp[1])) });
        return { entries };
      }

      const plot = input.match(/^plot\s*(?:\((.+)\)|(.+))$/i);
      if (plot) {
        const src = (plot[1] ?? plot[2]).trim().replace(/^["']|["']$/g, "");
        entries.push({ type: "plot", src });
        return { entries, plot: src };
      }

      // Assignment: name = expression (mathjs stores it in scope) ---------
      const value = evaluate(input);
      const assign = input.match(/^([A-Za-z]\w*)\s*=/);
      if (assign) {
        entries.push({ type: "out", text: `${assign[1]} =\n${formatValue(value)}` });
      } else if (value !== undefined) {
        scope.ans = value;
        entries.push({ type: "out", text: `ans =\n${formatValue(value)}` });
      }
      return { entries };
    } catch (e) {
      entries.push({
        type: "err",
        text: e instanceof Error ? e.message : "Could not run that command",
      });
      return { entries };
    }
  };

  return {
    run,
    reset: () => { scope = {}; },
    names: () => Object.keys(scope),
  };
}
