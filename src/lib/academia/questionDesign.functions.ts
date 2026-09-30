import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuestionDesign = { instruction: string; math: string; source: string; ai: boolean; at: string };

const squash = (s: string) => s.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();

/** Deterministic split used when AI is unavailable or fails the question lock. */
export function plainDesign(source: string): QuestionDesign {
  const text = source.trim();
  const m = text.match(/^(.*?(?:solve for [a-z]|simplify|evaluate|find [^,:]*?|expand|factori[sz]e|calculate|work out)\b[^:,]*?)(?:[:,]|\s+(?:when|if|given|where))\s*(.+)$/i);
  const at = new Date().toISOString();
  if (m) return { instruction: m[1]!.trim(), math: m[2]!.trim(), source: text, ai: false, at };
  return { instruction: "", math: text, source: text, ai: false, at };
}

/**
 * AI redesign of a question card: an instruction line and the maths set apart.
 * QUESTION_LOCK: the maths must appear verbatim (ignoring spaces) in the
 * original, otherwise the plain split is saved instead.
 */
export const designAcademiaQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ activityId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await db.from("academia_activities").select("id, title").eq("id", data.activityId).maybeSingle();
    if (error || !row) throw new Error("This question could not be found.");
    const source = String(row.title ?? "").trim();
    let design = plainDesign(source);
    try {
      const { gatewayText, extractJson } = await import("@/lib/ai/gateway.server");
      const raw = await gatewayText(
        [
          "You format a school maths question for a display card.",
          "Split it into a short instruction (e.g. 'Solve for x') and the mathematical expression/equation.",
          "Copy the mathematics EXACTLY as written: same numbers, signs, variables and exponents. Never solve, never change the question.",
          "Write the maths in plain readable form (x + 5 = 15, x^2, 3/4). Keep the instruction under 12 words.",
          'Reply with strict JSON only: {"instruction":"...","math":"..."}. Keep the whole reply under 60 words.',
        ].join(" "),
        source,
      );
      const parsed = extractJson<{ instruction?: string; math?: string }>(raw);
      const math = String(parsed.math ?? "").trim();
      if (math && squash(source).includes(squash(math).replace(/\^/g, "^"))) {
        design = { instruction: String(parsed.instruction ?? "").trim(), math, source, ai: true, at: new Date().toISOString() };
      }
    } catch {
      /* keep the plain design — the question is never lost */
    }
    const { error: upErr } = await db.from("academia_activities").update({ question_design: design }).eq("id", data.activityId);
    if (upErr) throw new Error("Only the teacher who builds this Subject can redesign its questions.");
    return design;
  });
