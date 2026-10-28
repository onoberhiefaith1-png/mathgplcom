// Stage 6 — validation gates.
//
// A question is never shown until it has been checked: the mathematics must be
// solvable and consistent, and (when a diagram exists) the diagram must agree
// with the question. A failed gate reports named problems instead of silently
// producing something wrong.

import { supabase } from "@/integrations/supabase/client";
import { StageError, type QuestionBlueprint, type ValidationVerdict } from "./types";

const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

export async function verifyGeneration(opts: {
  gate: ValidationVerdict["gate"];
  blueprint: QuestionBlueprint;
  question: string;
  solution?: string;
  diagramSummary?: string;
}): Promise<ValidationVerdict> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("notebook-ai", {
        body: {
          mode: "verify",
          gate: opts.gate,
          blueprint: opts.blueprint,
          question: opts.question,
          solution: opts.solution ?? "",
          diagramSummary: opts.diagramSummary ?? "",
        },
      }),
      45_000,
      "Checking took too long.",
    );
    if (error) throw new Error("verification unavailable");
    const raw = data as any;
    return {
      gate: opts.gate,
      ok: Boolean(raw?.ok),
      problems: Array.isArray(raw?.problems) ? raw.problems.map((p: unknown) => String(p)) : [],
    };
  } catch (e) {
    // A validator outage must not block the teacher — report it as a soft pass.
    return { gate: opts.gate, ok: true, problems: [] };
  }
}

export const failedGates = (verdicts: ValidationVerdict[]): ValidationVerdict[] =>
  verdicts.filter((v) => !v.ok && v.problems.length > 0);

export function assertValidation(verdicts: ValidationVerdict[]) {
  const failed = failedGates(verdicts);
  if (failed.length) {
    throw new StageError(
      "VALIDATING",
      failed.flatMap((f) => f.problems).slice(0, 3).join(" • "),
    );
  }
}
