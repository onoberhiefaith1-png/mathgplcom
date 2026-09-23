// A live call turn: Aura's answer streamed word by word, so her voice can start
// on the first clause instead of waiting for the whole reply to be written.

import { createFileRoute } from "@tanstack/react-router";

import { actorFromRequest } from "@/lib/agent/callAuth.server";

type Incoming = {
  messages?: { role?: string; content?: string }[];
  context?: Record<string, unknown> | null;
  call?: boolean;
};

export const Route = createFileRoute("/api/aura-turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const actor = await actorFromRequest(request);
        if (!actor) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as Incoming;
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .map((item) => ({
            role: item?.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: typeof item?.content === "string" ? item.content.trim() : "",
          }))
          .filter((item) => item.content.length > 0)
          .slice(-40);
        if (messages.length === 0) return new Response("Nothing to answer yet.", { status: 400 });

        const { streamAgentTurn } = await import("@/lib/agent/brain.server");
        const stream = await streamAgentTurn(
          { supabase: actor.supabase as never, userId: actor.userId },
          messages,
          { call: body.call === true },
          undefined,
          (body.context as never) ?? null,
        );

        const encoder = new TextEncoder();
        const body$ = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (payload: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            try {
              for await (const delta of stream.text) {
                if (delta) send({ type: "delta", text: delta });
              }
              send({ type: "done", turn: await stream.finish() });
            } catch (error) {
              send({ type: "error", message: (error as Error).message });
            } finally {
              controller.close();
            }
          },
          cancel: () => stream.abort(),
        });

        return new Response(body$, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
