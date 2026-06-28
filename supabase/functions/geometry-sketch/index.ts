// geometry-sketch — converts a freehand sketch (array of pointer strokes)
// into a clean GeometryScene. Sends a rasterized PNG of the strokes plus a
// JSON description to a vision-capable model and asks for a structured
// scene back.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SCHEMA = `
GeometryScene = {
  "bounds": { "width": number, "height": number },
  "objects": [
    { "id": string, "type": "point", "x": number, "y": number, "label"?: string },
    { "id": string, "type": "segment", "a": pointId, "b": pointId, "label"?: string, "marks"?: "tick"|"double"|"triple"|"right", "dashed"?: boolean },
    { "id": string, "type": "circle","center": pointId, "r": number, "label"?: string, "dashed"?: boolean },
    { "id": string, "type": "arc",   "center": pointId, "r": number, "from": deg, "to": deg, "dashed"?: boolean },
    { "id": string, "type": "angle", "vertex": pointId, "a": pointId, "b": pointId, "value"?: string, "marker"?: "arc"|"double"|"right" },
    { "id": string, "type": "polygon","points": [pointId,...], "fill"?: string, "label"?: string },
    { "id": string, "type": "label", "x": number, "y": number, "text": string }
  ],
  "meta"?: { "topic"?: string, "caption"?: string }
}
Top-left origin, y grows DOWNWARD.
`.trim();

const SYSTEM = `You convert a rough hand-drawn sketch into a clean, editable
mathematical GeometryScene.

RULES
- Identify the geometric intent — triangle, quadrilateral, circle, angle,
  perpendicular, tangent, etc. — and reconstruct it as proper mathematical
  objects, NOT a literal trace of the strokes.
- Snap to plausible right angles, equal sides, symmetric points, neat
  positions inside the given bounds. Use whole-number coordinates.
- Label vertices A, B, C, ... in counter-clockwise order when a polygon is
  obvious; otherwise leave labels off.
- Keep the figure inside the bounds with at least 20-unit padding.
- Use the schema below. Output STRICT JSON only: {"scene": <GeometryScene>}.

${SCHEMA}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const strokes = Array.isArray(body?.strokes) ? body.strokes : [];
    const bounds = body?.bounds ?? { width: 360, height: 240 };
    const topic = String(body?.topic ?? "").trim();

    if (strokes.length === 0) {
      return new Response(JSON.stringify({ error: "no strokes" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = `TOPIC: ${topic || "—"}
BOUNDS: ${JSON.stringify(bounds)}

The teacher's freehand sketch (each item is one stroke; points are {x,y} in
the same coordinate space as BOUNDS):
${JSON.stringify(strokes).slice(0, 20000)}

Reconstruct this into a clean GeometryScene. Output STRICT JSON only:
{"scene": {...}}.`;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway ${res.status}: ${text}`);
    }
    const json = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
    let parsedScene: unknown = null;
    try {
      const obj = JSON.parse(cleaned);
      parsedScene = obj?.scene ?? obj ?? null;
    } catch {
      parsedScene = null;
    }
    if (!parsedScene || typeof parsedScene !== "object") {
      return new Response(JSON.stringify({ error: "AI returned invalid scene", raw }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ scene: parsedScene }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
