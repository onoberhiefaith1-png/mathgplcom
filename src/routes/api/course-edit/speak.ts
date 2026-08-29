import { createFileRoute } from "@tanstack/react-router";

const MAX_CHARS = 4000;

/**
 * Text-to-speech for ONE script segment. Only text is sent — never audio or video.
 */
export const Route = createFileRoute("/api/course-edit/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI is not configured for this project" }, 500);

        let body: { text?: unknown; voice?: unknown; instructions?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid request" }, 400);
        }
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) return json({ error: "Nothing to speak" }, 400);
        if (text.length > MAX_CHARS) return json({ error: "That segment is too long" }, 400);
        const voice = typeof body.voice === "string" && /^[a-z][a-z0-9-]{2,32}$/.test(body.voice)
          ? body.voice
          : "alloy";

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            response_format: "mp3",
            ...(typeof body.instructions === "string" && body.instructions.trim()
              ? { instructions: body.instructions.slice(0, 700) }
              : {}),
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          const status = response.status === 429 || response.status === 402 ? response.status : 502;
          return json({ error: speechError(response.status, detail) }, status);
        }

        return new Response(response.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

function speechError(status: number, detail: string): string {
  if (status === 429) return "Too many AI requests right now — wait a moment and retry.";
  if (status === 402) return "Your AI credits are exhausted. Add credits to continue.";
  if (status === 403 || status === 404) return "AI voice generation is not enabled for this workspace.";
  return `Voice generation failed (${status}). ${detail.slice(0, 200)}`;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
