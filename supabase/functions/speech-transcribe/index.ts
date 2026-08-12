import { meterFunction } from "../_shared/usageMeter.ts";
meterFunction("speech-transcribe");
// Speech-to-text proxy — streams Lovable AI's gpt-4o-mini-transcribe back to
// the browser as SSE so the AssistantPanel can fill the input box live.
// No audio is stored anywhere; we just pipe the multipart upload upstream
// and stream the transcript events back.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return new Response(
        JSON.stringify({ error: "Empty or missing audio file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mime = (file.type || "audio/webm").split(";")[0];
    const ext = MIME_EXT[mime] ?? "webm";

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("stream", "true");
    upstream.append("file", file, `recording.${ext}`);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Transcription failed: ${res.status}`, detail: txt.slice(0, 500) }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
