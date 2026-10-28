import { meterFunction } from "../_shared/usageMeter.ts";
meterFunction("smart-graph");
// smart-graph — turn a teacher prompt + scale into a plotted data set.
// Returns { points: [{x,y}], connect: "straight"|"smooth"|"broken"|"scatter", xLabel?, yLabel? }.
// The teacher always remains in control: the response is just suggested
// data and the SmartGraph NodeView merges it into the existing graph.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  prompt?: string;
  unitsPerSquareX?: number;
  unitsPerSquareY?: number;
  squaresX?: number;
  squaresY?: number;
  originSquareX?: number;
  originSquareY?: number;
  xLabel?: string;
  yLabel?: string;
}

const SYSTEM = `You generate data for a classroom Cartesian graph.
Return STRICT JSON only:
{
  "points":  [{"x": number, "y": number}, ...],
  "connect": "straight" | "smooth" | "broken" | "scatter",
  "xLabel":  "optional axis label",
  "yLabel":  "optional axis label"
}
Rules:
- Honour the user's scale and visible range. Keep every point inside the visible window.
- 6–25 points is ideal. For straight lines use 2–5; for curves use 12–25 evenly spaced x-values.
- Use sensible classroom decimals (max 2dp).
- "connect" defaults to "smooth" for curves, "straight" for linear data, "scatter" for pure data points.
- No explanations outside the JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const b = (await req.json().catch(() => ({}))) as Body;
    const prompt = (b.prompt ?? "").toString().trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const upx = b.unitsPerSquareX ?? 1, upy = b.unitsPerSquareY ?? 1;
    const sx = b.squaresX ?? 20, sy = b.squaresY ?? 14;
    const ox = b.originSquareX ?? sx / 2, oy = b.originSquareY ?? sy / 2;
    const xMin = -(ox) * upx, xMax = (sx - ox) * upx;
    const yMin = -(sy - oy) * upy, yMax = (oy) * upy;

    const user = `Request: ${prompt}
Visible window:
  x: ${xMin} to ${xMax}  (scale: 1 square = ${upx} unit${upx === 1 ? "" : "s"})
  y: ${yMin} to ${yMax}  (scale: 1 square = ${upy} unit${upy === 1 ? "" : "s"})
Axes: ${b.xLabel ?? "x"} / ${b.yLabel ?? "y"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
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
    let parsed: { points?: Array<{ x: number; y: number }>; connect?: string; xLabel?: string; yLabel?: string };
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const okConnect = ["straight", "smooth", "broken", "scatter"];
    const points = Array.isArray(parsed.points)
      ? parsed.points
          .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
          .map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }))
      : [];

    return new Response(JSON.stringify({
      points,
      connect: okConnect.includes(String(parsed.connect)) ? parsed.connect : "smooth",
      xLabel: parsed.xLabel ? String(parsed.xLabel) : undefined,
      yLabel: parsed.yLabel ? String(parsed.yLabel) : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
