import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SESSION_PAIRING_STANDARD } from "./sessionPairingStandard";

const KINDS = ["introduction", "explanation", "example", "exercise", "classwork", "homework", "assessment", "summary"];

/**
 * Classify every top-level block of a lesson note into sessions
 * (introduction / explanation / question / solution / summary) and pair each
 * solution with its question. It only classifies and optionally tidies the
 * wording of plain lines — it never writes mathematics.
 */
export const classifyLessonNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ blocks: z.array(z.string().max(600)).max(600), topic: z.string().max(200).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const system = [
      "You are the MathGPL lesson-structure engine. You receive a lesson note as numbered top-level blocks.",
      "Decide which session every block belongs to. Headings that only name a session (\"Classwork\", \"Solution 2\") may be left out of every segment; they are rebuilt.",
      SESSION_PAIRING_STANDARD,
      "Return ONLY JSON: {\"segments\":[{\"kind\":string,\"role\":\"content\"|\"question\"|\"solution\",\"blocks\":number[],\"pairsWith\":number|null,\"tidied\":{\"<blockIndex>\":string}}]}.",
      `kind is one of: ${KINDS.join(", ")}. For a solution segment, kind is the kind of its question and pairsWith is the index (in your segments array) of the question it answers.`,
      "Order segments in teaching order: introduction, explanation, then each question immediately followed by its solution, then summary. Keep the teacher's order of questions.",
      "Every non-empty block index must appear in exactly one segment. One question per question segment — split grouped questions.",
      "tidied is optional: only for plain wording lines (no equations) that are unclear; keep every number identical.",
    ].join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${data.topic ? `Topic: ${data.topic}\n\n` : ""}${data.blocks.join("\n")}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Too many requests right now — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are used up — please top up to restructure.");
    if (!res.ok) throw new Error(`Restructure failed (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    const segments = Array.isArray(parsed?.segments) ? parsed.segments : [];
    return {
      segments: segments
        .map((s: any) => ({
          kind: KINDS.includes(String(s?.kind)) ? String(s.kind) : "explanation",
          role: ["content", "question", "solution"].includes(String(s?.role)) ? String(s.role) : "content",
          blocks: (Array.isArray(s?.blocks) ? s.blocks : [])
            .map((n: unknown) => Number(n))
            .filter((n: number) => Number.isInteger(n) && n >= 0 && n < data.blocks.length),
          pairsWith: Number.isInteger(s?.pairsWith) ? Number(s.pairsWith) : null,
          tidied:
            s?.tidied && typeof s.tidied === "object"
              ? Object.fromEntries(
                  Object.entries(s.tidied).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]),
                )
              : {},
        }))
        .filter((s: any) => s.blocks.length > 0 || s.role === "question"),
    };
  });
