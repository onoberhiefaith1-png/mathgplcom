import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Educational thumbnails for Academia sessions and activities. The picture is
 * drawn from the real teaching context (Topic, Subtopic, Session, or the
 * activity's own task) and stored in the Academia's private folder.
 */
export const generateAcademiaThumbnail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        academiaId: z.string().uuid(),
        label: z.string().regex(/^[a-z0-9-]{1,40}$/),
        topic: z.string().max(200).optional(),
        subtopic: z.string().max(200).optional(),
        session: z.string().max(200).optional(),
        task: z.string().max(800).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const ctx = [
      data.topic && `Topic: ${data.topic}.`,
      data.subtopic && `Subtopic: ${data.subtopic}.`,
      data.session && `Lesson: ${data.session}.`,
      data.task && `Learning task: ${data.task}.`,
    ]
      .filter(Boolean)
      .join(" ");
    const prompt = [
      "A clean, premium educational thumbnail illustration, landscape 16:9, dark navy background with warm gold accents.",
      "It must visually represent exactly this mathematics/learning concept, not a generic maths picture.",
      ctx,
      "Use diagrams, shapes and visual metaphors of the concept. No words, no lettering, no logos.",
    ].join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size: "1536x1024", quality: "low", n: 1 }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many picture requests right now — try again in a minute.");
      if (res.status === 402) throw new Error("AI credits have run out.");
      throw new Error(`Picture generation failed (${res.status})`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("The AI returned no image");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${data.academiaId}/${data.label}-ai-${Date.now()}.png`;
    const { error } = await context.supabase.storage
      .from("academia-media")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    return { path };
  });
