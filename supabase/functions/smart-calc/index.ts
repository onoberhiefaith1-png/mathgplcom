// smart-calc — convert an expression or word problem into a structured
// working block: { formula, substitution, steps[], answer }. The teacher
// always remains in control of every line via the SmartCalc NodeView.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { expression?: string }

const SYSTEM = `You are a mathematics teacher's calculation assistant for West African secondary school.
Given a mathematical expression OR a short word problem, return STRICT JSON with this shape — nothing else:
{
  "formula":      "general formula being used (one line, may be empty)",
  "substitution": "the formula with values substituted (one line, may be empty)",
  "steps":        ["step 1 working", "step 2 working", "..."],
  "answer":       "final answer with units if applicable"
}
Rules:
- Show micro-steps, one per array element. NEVER skip transitions.
- Use proper math notation (² ³ √ × ÷ π) — no LaTeX, no ASCII tricks.
- Stacked fractions written as a/b inline are fine.
- If the problem doesn't need a formula, leave "formula" and "substitution" empty.
- Keep every string short. Do NOT include explanations outside the JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const expression = (body.expression ?? "").toString().trim();
    if (!expression) {
      return new Response(JSON.stringify({ error: "expression required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: expression },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `gateway ${resp.status}: ${text}` }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { formula?: string; substitution?: string; steps?: string[]; answer?: string };
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return new Response(JSON.stringify({
      formula: String(parsed.formula ?? ""),
      substitution: String(parsed.substitution ?? ""),
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
      answer: String(parsed.answer ?? ""),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
