// Geometry Map generation — builds the map FROM THE SOLUTION.
//
// Input: the question text, the complete generated solution, and a read-only
// inventory of the diagram's objects (stable ids + truthful names).
// Output: one item per mathematical principle the solution actually used, in
// solution order, each grounded in real object ids. No measured values, no
// extra theorems, and nothing that could edit the diagram.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  question: z.string().default(""),
  solution: z.string().min(1),
  topic: z.string().default(""),
  objects: z
    .array(
      z.object({
        id: z.string(),
        type: z.string().default(""),
        typeLabel: z.string().default(""),
        name: z.string().default(""),
      }),
    )
    .default([]),
});

export interface GeneratedMapItem {
  principle: string;
  relation: string;
  explanation: string;
  usedTo: string;
  stepIndex: number;
  producesToken?: string;
  needsTokens?: string[];
  objectIds: string[];
}

const SYSTEM = `You are the Geometry Map builder for MathGPL.

You are given a geometry QUESTION, the COMPLETE SOLUTION that was generated
for it, and the read-only OBJECT INVENTORY of the diagram.

TASK: extract ONLY the mathematical principles/theorems/rules that the
SOLUTION actually used, in the order the solution used them, and link each one
to the diagram objects it applies to.

HARD RULES:
- The solution is the source of truth. NEVER add a theorem the solution did
  not use, however applicable it may look on the diagram.
- ONE map item = ONE principle. Never merge several principles into one item.
- NO NUMERICAL ANSWERS. Write the theory symbolically using the diagram's own
  labels (A, B, C, D, x, θ, AB, ∠ABC, arc AB). Structural constants such as
  180°, 90° and 360° are allowed inside a formula; measured values
  (40°, 10 cm, 8.4) are forbidden anywhere in the map.
- "objectIds" MUST come from the supplied inventory ids. Never invent an id,
  a point or a label. If a step cannot be grounded in any id, return an empty
  array for it rather than guessing.
- "usedTo" says what the step established, symbolically: "Used to find BC",
  "Establishes the right angle at the point of tangency".
- "producesToken" is the symbol the step establishes ("BC", "∠BDC", "BD").
  "needsTokens" are the symbols it consumed from earlier steps.
- "stepIndex" is the 1-based solution step the principle came from.

OUTPUT — STRICT JSON, no fences, no prose:
{"items":[{"principle":string,"relation":string,"explanation":string,"usedTo":string,"stepIndex":number,"producesToken"?:string,"needsTokens"?:string[],"objectIds":string[]}]}`;

const KEEP_VALUES = new Set(["180", "90", "360", "270", "45", "60", "30"]);
const UNIT = "(?:°|deg|cm|mm|m|km|in|ft|units?)";

/** Server-side guarantee that no measured value reaches the map. */
function stripNumbers(text: unknown): string {
  return String(text ?? "")
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}`, "gi"), (m, n: string) =>
      KEEP_VALUES.has(n) ? m : "",
    )
    .replace(/\b\d+\.\d+\b/g, "")
    .replace(/\b(?:approx\.?|approximately|about)\b\s*/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([=+\-−×÷,])\s*$/g, "")
    .trim();
}

function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
}

export const generateGeometryMap = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ items: GeneratedMapItem[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const ids = new Set(data.objects.map((o) => o.id));
    const userText = `TOPIC: ${data.topic || "—"}

QUESTION:
${data.question || "—"}

SOLUTION (the source of truth — extract its principles, in order):
${data.solution}

DIAGRAM OBJECT INVENTORY (use these ids only):
${JSON.stringify(data.objects)}

Return STRICT JSON: {"items": [...]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 402) throw new Error("Out of AI credits — top up to keep generating.");
      if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
      throw new Error(`Map generation failed (${res.status}): ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let parsed: { items?: unknown[] } | null = null;
    try {
      parsed = JSON.parse(stripFences(json.choices?.[0]?.message?.content ?? ""));
    } catch {
      parsed = null;
    }
    const list = Array.isArray(parsed?.items) ? parsed!.items : [];

    const items: GeneratedMapItem[] = [];
    list.slice(0, 40).forEach((raw, i) => {
      const it = raw as Record<string, unknown>;
      const principle = String(it?.["principle"] ?? "").trim();
      if (!principle) return;
      const objectIds = (Array.isArray(it["objectIds"]) ? it["objectIds"] : [])
        .map((x) => String(x))
        .filter((x) => ids.has(x));
      const needs = Array.isArray(it["needsTokens"])
        ? it["needsTokens"].map((t) => stripNumbers(t)).filter(Boolean)
        : undefined;
      const produces = it["producesToken"] ? stripNumbers(it["producesToken"]) : "";
      items.push({
        principle,
        relation: stripNumbers(it["relation"]),
        explanation: stripNumbers(it["explanation"]),
        usedTo: stripNumbers(it["usedTo"]),
        stepIndex: Number.isFinite(Number(it["stepIndex"])) ? Number(it["stepIndex"]) : i + 1,
        ...(produces ? { producesToken: produces } : {}),
        ...(needs && needs.length ? { needsTokens: needs } : {}),
        objectIds: [...new Set(objectIds)],
      });
    });

    return { items };
  });
