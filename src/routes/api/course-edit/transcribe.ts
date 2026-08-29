import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 24 * 1024 * 1024;

/**
 * Audio-only transcription. The client sends a short WAV chunk of the
 * EXTRACTED audio — the video file is never uploaded.
 */
export const Route = createFileRoute("/api/course-edit/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI is not configured for this project" }, 500);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Expected an audio upload" }, 400);
        }
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return json({ error: "No audio was received" }, 400);
        }
        if (file.size > MAX_BYTES) {
          return json({ error: "That audio chunk is too large" }, 413);
        }
        if (!file.type.startsWith("audio/")) {
          return json({ error: "Only audio uploads are accepted" }, 400);
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, "audio.wav");
        const language = form.get("language");
        if (typeof language === "string" && /^[a-z]{2}$/.test(language)) {
          upstream.append("language", language);
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return json(
            { error: transcriptionError(response.status, detail) },
            response.status === 429 || response.status === 402 ? response.status : 502,
          );
        }

        const result = (await response.json()) as { text?: string };
        return json({ text: result.text ?? "" }, 200);
      },
    },
  },
});

function transcriptionError(status: number, detail: string): string {
  if (status === 429) return "Too many AI requests right now — wait a moment and retry.";
  if (status === 402) return "Your AI credits are exhausted. Add credits to continue.";
  if (status === 403 || status === 404) return "AI transcription is not enabled for this workspace.";
  return `Transcription failed (${status}). ${detail.slice(0, 200)}`;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
