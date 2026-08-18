// Generates the artwork used as a Session or Sub-Session cover in the official
// asset library. Only asset managers may call it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3.1-flash-image";

const buildPrompt = (name: string, hint: string) =>
  `Cover artwork for a mathematics-classroom asset folder called "${name}". ${hint} ` +
  "Rich painterly game-art illustration, luminous colour, clean central subject, " +
  "square composition, no text, no words, no letters, no watermark.";

export const generateFolderCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(1).max(120),
        hint: z.string().max(400).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage_gpl_assets");
    if (allowed !== true) throw new Error("Only asset managers can generate covers.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Image generation is not configured.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(data.name, data.hint ?? "") }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 429) throw new Error("The image service is busy — try again shortly.");
      if (response.status === 402) throw new Error(detail || "Out of AI credits.");
      throw new Error(detail || "Cover generation failed.");
    }

    const payload = (await response.json()) as { data?: { b64_json?: string }[] };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image was returned.");

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `official/covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("game-assets")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);

    return { path };
  });
