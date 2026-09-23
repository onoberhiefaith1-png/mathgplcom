import { createFileRoute } from "@tanstack/react-router";

import { requestSpeech } from "@/lib/agent/speech.server";

/** Phase 4 — streams Aura's spoken reply as PCM audio events the cockpit plays. */
export const Route = createFileRoute("/api/aura-speech")({
  server: {
    handlers: {
      // Warm-up from the call: opens the connection before her first clause.
      HEAD: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { text?: string };
        const text = (body.text ?? "").toString().slice(0, 1200).trim();
        if (!text) return new Response("Nothing to say", { status: 400 });

        let upstream: Response | null;
        try {
          upstream = await requestSpeech(text, request.signal);
        } catch (error) {
          if (request.signal.aborted) return new Response("Cancelled", { status: 499 });
          throw error;
        }
        if (!upstream) return new Response("Speech is not configured", { status: 503 });
        if (!upstream.ok) {
          const detail = await upstream.text();
          console.error(`Aura speech failed [${upstream.status}]: ${detail}`);
          return new Response(detail, { status: upstream.status });
        }

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
