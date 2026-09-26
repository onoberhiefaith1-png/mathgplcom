// Server helpers for Flow (ported from the FLOW project's flow-qa and
// flow-library-bg functions). Same prompts and behaviour.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QA_PROMPT =
  "Each image is one frame of a character video whose background was cut out, shown composited on a split checkerboard/black/white backdrop. For each frame decide ok=true if the whole character is intact AND no leftover original background (patches, halos, boxes) remains. Otherwise ok=false with a short issue. Reply only with JSON {\"frames\":[{\"index\":n,\"ok\":bool,\"issue\":string|null}]}. Frame indices in order: ";

export const flowQa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ frames: z.array(z.object({ index: z.number(), image: z.string() })) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key || !data.frames.length) return { frames: [] as { index: number; ok: boolean; issue: string | null }[], error: key ? undefined : "unavailable" };
    const content: unknown[] = [{ type: "text", text: QA_PROMPT + data.frames.map((f) => f.index).join(", ") }];
    for (const f of data.frames.slice(0, 12)) content.push({ type: "image_url", image_url: { url: f.image } });
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return { frames: [], error: `AI check failed (${res.status})` };
      const j = await res.json();
      const parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? "{}");
      return { frames: Array.isArray(parsed?.frames) ? parsed.frames : [], error: undefined };
    } catch (e) {
      return { frames: [], error: (e as Error).message };
    }
  });

export const flowLibraryBg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ prompt: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId)
      .in("role", ["platform_owner", "co_admin"]).limit(1).maybeSingle();
    if (!role) throw new Error("Administrators only");
    const extra = data.prompt ?? "";
    const prompt = `Wide 16:9 cinematic background for a magical mathematics character library. ${extra || "Soft glowing night sky, floating geometric shapes and constellations, calm deep blues with warm gold light"}. Leave the centre uncluttered. No text, no letters, no characters.`;
    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
    });
    if (!ai.ok) throw new Error(ai.status === 429 ? "Too many requests, try again shortly" : ai.status === 402 ? "AI credits exhausted" : "Image generation failed");
    const j = await ai.json();
    const url: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const b64 = url?.split(",")[1];
    if (!b64) throw new Error("No image returned");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${context.userId}/library/bg-${Date.now()}.png`;
    const up = await context.supabase.storage.from("flow-videos").upload(path, bytes, { contentType: "image/png" });
    if (up.error) throw new Error(up.error.message);
    const { error } = await (context.supabase.from("flow_library_settings" as never) as any)
      .upsert({ id: 1, background_path: path, background_type: "image", updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { background_path: path };
  });
