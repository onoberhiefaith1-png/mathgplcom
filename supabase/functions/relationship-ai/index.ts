import { meterFunction } from "../_shared/usageMeter.ts";
meterFunction("relationship-ai");
// relationship-ai — suggests mathematical relationships for a selection
// in a GeometryScene. AI assists; the teacher reviews/edits/approves.

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are the Geometry Relationship Assistant.

ROLE: Suggest mathematical relationships (theorems, properties, formulae)
that apply to the parts the teacher has selected in a diagram. You do NOT
edit the diagram itself. You SUGGEST — the teacher approves.

RULES:
- Use ONLY values, labels, and parts that exist in the provided selection
  and scene. NEVER invent new variables. If a value is unknown, reuse the
  label that already exists in the diagram (e.g. ∠BCA, x if x is already
  on the diagram). Do NOT add y, z unless they appear in the scene.
- Keep each relationship short: one name + one formula + one explanation.
- Tailor wording to the topic and audience if given (e.g. JSS1, WAEC, GCSE).
- Generic form goes in "formula" (symbolic). Substituted form using REAL
  values from the scene goes in "applied" (omit if no useful substitution).
- Confidence: "high" when the theorem definitely applies, "medium" when it
  may apply.

OUTPUT — STRICT JSON, no fences, no prose:
{
  "relationships": [
    {
      "name": string,
      "formula": string,
      "applied"?: string,
      "explanation": string,
      "confidence": "high" | "medium"
    }
  ]
}`;

/**
 * Whole-diagram analysis: one pass over every component of the diagram,
 * answering "what can this component be used to find, prove or relate to?".
 */
const SYSTEM_MAP = `You are the Geometry Relationship Assistant for MathGPL.

TASK: Analyse the WHOLE geometry diagram supplied as a read-only object
inventory. For EVERY meaningful component (points, segments/lines/rays,
angles, arcs, circles, regions, labelled values), decide what that component
can be used to find, prove, calculate or relate to in THIS diagram, and emit
those relationships.

HARD RULES:
- Every relationship MUST reference objects by the exact ids given in
  OBJECTS. Never invent ids, labels, points or variables. If you cannot
  ground a relationship in the given ids, omit it.
- Only mathematically applicable relationships. Sine Rule / Cosine Rule /
  triangle relationships ONLY when the triangle in question actually exists
  in the inventory (its three segments/points are present).
- Statements are written the way a teacher writes them on the board:
  "∠ACD + ∠DCB = 180°", "AB = AC", "AB ∥ CD", "Area = ½ × base × height".
- "reason" is a SHORT justification: "Given", "Angles on a straight line",
  "Angles in the same segment", "Isosceles triangle", "Sine Rule".
- "group" classifies the relationship: "angle", "line", "area" or "theorem".
- "category": "specific" when it is about THIS diagram's values,
  "general" when it is a definition/rule that always holds.
- 3 to 8 relationships per component at most; skip components with nothing
  useful to say.

OUTPUT — STRICT JSON, no fences, no prose:
{
  "relationships": [
    {
      "componentId": string,          // the id this belongs to
      "content": string,              // the statement
      "reason": string,
      "group": "angle" | "line" | "area" | "theorem",
      "category": "specific" | "general",
      "kind": "statement" | "definition" | "theorem" | "property" | "formula",
      "connectedObjectIds": string[]  // every id involved, componentId included
    }
  ]
}`;


function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const scene = body?.scene;
    const selection = body?.selection ?? [];
    const existing = body?.existing ?? [];
    const instruction = String(body?.instruction ?? "").trim();
    const topic = String(body?.topic ?? "").trim();
    const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 4) : [];

    if (!scene) {
      return new Response(JSON.stringify({ error: "missing scene" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── whole-diagram mode: one relationship map for every component ── */
    if (body?.mode === "map") {
      const objects: Array<{ id: string; type: string; name?: string }> =
        Array.isArray(body?.objects) ? body.objects : [];
      const ids = new Set(objects.map((o) => String(o.id)));
      const mapText = `TOPIC: ${topic || "—"}

OBJECTS (the complete diagram — use these ids only):
${JSON.stringify(objects)}

SCENE (read-only geometry, for coordinates and marks):
${JSON.stringify(scene)}

EXISTING RELATIONSHIPS (do not duplicate):
${JSON.stringify(existing)}

TEACHER INSTRUCTION:
${instruction || "Build the relationship map for this diagram."}

Return STRICT JSON: {"relationships": [...]}`;

      const mapRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_MAP },
            { role: "user", content: mapText },
          ],
        }),
      });
      if (!mapRes.ok) {
        const text = await mapRes.text();
        return new Response(JSON.stringify({ error: `AI gateway ${mapRes.status}: ${text}` }), {
          status: mapRes.status === 402 || mapRes.status === 429 ? mapRes.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mapJson = await mapRes.json();
      const mapRaw: string = mapJson.choices?.[0]?.message?.content ?? "";
      let parsed: any = null;
      try { parsed = JSON.parse(stripFences(mapRaw)); } catch { parsed = null; }
      const list = Array.isArray(parsed?.relationships) ? parsed.relationships : [];
      // Server-side grounding: drop anything that references an id which is
      // not in the diagram, and anything with no valid component.
      const groups = new Set(["angle", "line", "area", "theorem"]);
      const clean = list
        .map((r: any) => {
          const componentId = String(r?.componentId ?? "");
          const connected = (Array.isArray(r?.connectedObjectIds) ? r.connectedObjectIds : [])
            .map((x: unknown) => String(x))
            .filter((x: string) => ids.has(x));
          if (!ids.has(componentId)) return null;
          const content = String(r?.content ?? "").trim();
          if (!content) return null;
          return {
            componentId,
            content,
            reason: String(r?.reason ?? "").trim(),
            group: groups.has(r?.group) ? r.group : "theorem",
            category: r?.category === "general" ? "general" : "specific",
            kind: typeof r?.kind === "string" ? r.kind : "statement",
            connectedObjectIds: [...new Set([componentId, ...connected])],
          };
        })
        .filter(Boolean)
        .slice(0, 120);

      return new Response(JSON.stringify({ relationships: clean }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = `TOPIC: ${topic || "—"}

SCENE (read-only context):
${JSON.stringify(scene)}

CURRENT SELECTION (the teacher highlighted these parts):
${JSON.stringify(selection)}

EXISTING RELATIONSHIPS (do not duplicate):
${JSON.stringify(existing)}

TEACHER INSTRUCTION:
${instruction || "Suggest relevant mathematical relationships for the selection."}

Return STRICT JSON: {"relationships": [...]}`;

    const userContent: any[] = [{ type: "text", text: userText }];
    for (const url of images) {
      if (typeof url === "string" && url.startsWith("data:image/")) {
        userContent.push({ type: "image_url", image_url: { url } });
      }
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `AI gateway ${res.status}: ${text}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    let out: any = null;
    try { out = JSON.parse(stripFences(raw)); } catch { out = null; }
    const relationships = Array.isArray(out?.relationships) ? out.relationships : [];
    return new Response(JSON.stringify({ relationships }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
