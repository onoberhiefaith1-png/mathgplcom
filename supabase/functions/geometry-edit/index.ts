// geometry-edit — AI editor for a GeometryScene. Receives the current
// scene + a teacher instruction (and optional reference images) and
// returns the next scene. The teacher reviews + applies in the panel.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SCHEMA = `
GeometryScene = {
  "bounds": { "width": number, "height": number },
  "objects": [
    { "id": string, "type": "point", "x": number, "y": number, "label"?: string, "labelOffset"?: {dx,dy}, "hidden"?: boolean },
    { "id": string, "type": "segment", "a": pointId, "b": pointId, "label"?: string, "marks"?: "tick"|"double"|"triple"|"right", "dashed"?: boolean },
    { "id": string, "type": "line",  "a": pointId, "b": pointId, "dashed"?: boolean },
    { "id": string, "type": "ray",   "a": pointId, "b": pointId, "dashed"?: boolean },
    { "id": string, "type": "circle","center": pointId, "r": number, "label"?: string, "dashed"?: boolean },
    { "id": string, "type": "arc",   "center": pointId, "r": number, "from": deg, "to": deg, "dashed"?: boolean },
    { "id": string, "type": "angle", "vertex": pointId, "a": pointId, "b": pointId, "value"?: string, "marker"?: "arc"|"double"|"right" },
    { "id": string, "type": "polygon","points": [pointId,...], "fill"?: string, "label"?: string },
    { "id": string, "type": "label", "x": number, "y": number, "text": string }
  ],
  "meta"?: { "topic"?: string, "caption"?: string }
}
Coordinates: top-left origin, y grows DOWNWARD.
`.trim();

const SYSTEM = `You are the Geometry AI Editor — a precision editor for an
editable mathematical diagram represented as a GeometryScene JSON document.

ROLE: EDITOR, NOT REGENERATOR.
- Apply ONLY the teacher's requested change. Preserve every other object
  exactly as it is — same ids, same coordinates, same labels.
- When a change to one object forces dependent geometry to move (e.g.
  enlarging a triangle changes the vertex positions), update only what is
  mathematically required.
- Keep existing ids stable. Add new ids only for genuinely new objects.
- Never re-author the whole figure from scratch unless the teacher says so
  ("redraw", "start over", "replace with...").
- If the teacher uploads a reference image, match its STRUCTURE (which
  objects, which labels, which markings) — not its pixel layout.

DIAGRAM STYLE: textbook clarity — clean, labeled, no clutter, no
construction debris. Use tick marks for equal sides, right-angle squares
for 90°, and small arcs for marked angles.

SCHEMA:
${SCHEMA}

OUTPUT — STRICT JSON ONLY, no fences, no prose:
  {"scene": <GeometryScene>}
`;

function stripFences(s: string): string {
  return s.trim()
    .replace(/^```json\s*|\s*```$/g, "")
    .replace(/^```\s*|\s*```$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const scene = body?.scene;
    const instruction = String(body?.instruction ?? "").trim();
    const topic = String(body?.topic ?? "").trim();
    const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 4) : [];

    if (!scene) {
      return new Response(JSON.stringify({ error: "missing scene" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = `TOPIC: ${topic || "—"}

CURRENT SCENE (edit this — keep every id you do not need to change):
${JSON.stringify(scene)}

TEACHER INSTRUCTION:
${instruction || "Improve the diagram while keeping the teacher's mathematical structure."}

Return the next GeometryScene as STRICT JSON: {"scene": {...}}.`;

    const userContent: any[] = [{ type: "text", text: userText }];
    for (const url of images) {
      if (typeof url === "string" && url.startsWith("data:image/")) {
        userContent.push({ type: "image_url", image_url: { url } });
      }
    }

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
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway ${res.status}: ${text}`);
    }
    const json = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    const cleaned = stripFences(raw);

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
