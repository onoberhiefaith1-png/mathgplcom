const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) throw new Error("ELEVENLABS_API_KEY missing");

    const isMusic = body.mode === "music";
    const url = isMusic
      ? "https://api.elevenlabs.io/v1/music"
      : "https://api.elevenlabs.io/v1/sound-generation";
    const payload = isMusic
      ? { prompt: body.prompt, music_length_ms: Math.round((body.duration_seconds ?? 30) * 1000) }
      : { text: body.prompt, duration_seconds: body.duration_seconds, prompt_influence: 0.5 };

    const r = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    return new Response(buf, { status: 200, headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
