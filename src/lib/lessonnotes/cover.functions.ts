import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI notebook-cover artwork. Generates a fresh cover illustration from the
 * teacher's prompt (layout, graphics, colour theme) and returns it as base64
 * PNG for the client to store against the notebook.
 */
export const generateCoverArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        prompt: z.string().trim().min(3).max(1200),
        themeName: z.string().trim().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const prompt = [
      "Design a professional printed notebook cover artwork, portrait 3:4.",
      data.themeName ? `Visual style: ${data.themeName}.` : "",
      data.prompt,
      "Rich background graphics, patterns and colour theme only.",
      "Leave the centre and lower third calm and uncluttered so cover text can be printed on top.",
      "No lettering, no words, no numbers, no logos.",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1024x1536",
        quality: "low",
        n: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cover generation failed (${res.status}) ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("The AI returned no image");
    return { b64 };
  });
