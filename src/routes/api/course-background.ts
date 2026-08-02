import { createFileRoute } from "@tanstack/react-router";

/** AI course background. Returns a base64 data URL the client uploads into
 *  the teacher's own course-media folder. */
export const Route = createFileRoute("/api/course-background")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { prompt?: string };
        const prompt = (body.prompt ?? "").toString().slice(0, 400).trim();
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured", { status: 503 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            modalities: ["image", "text"],
            messages: [
              {
                role: "user",
                content: `A premium, cinematic course cover illustration for a mathematics course about ${
                  prompt || "mathematics"
                }. No text, no words, wide composition, deep navy and gold palette.`,
              },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`AI background failed [${res.status}]: ${text}`);
          return new Response(text, { status: res.status });
        }
        const json = (await res.json()) as {
          choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
        };
        const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!dataUrl) return new Response("No image returned", { status: 502 });
        return Response.json({ dataUrl });
      },
    },
  },
});
