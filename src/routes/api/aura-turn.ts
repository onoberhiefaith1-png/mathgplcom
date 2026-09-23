// A live call turn, in two voices' worth of speed but only one voice.
//
// The fast brain answers the instant the teacher stops: it rebuilds what they
// meant and gives the one line Aura speaks straight away. Only when the request
// is real work does the deep worker run, continuing behind the same voice.

import { createFileRoute } from "@tanstack/react-router";

import { actorFromRequest } from "@/lib/agent/callAuth.server";

type Incoming = {
  messages?: { role?: string; content?: string }[];
  context?: Record<string, unknown> | null;
  call?: boolean;
};

/** A call keeps a short brief, not the whole conversation: flat cost per turn. */
const CALL_HISTORY = 10;

export const Route = createFileRoute("/api/aura-turn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const actor = await actorFromRequest(request);
        if (!actor) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as Incoming;
        const call = body.call === true;
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .map((item) => ({
            role: item?.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: typeof item?.content === "string" ? item.content.trim() : "",
          }))
          .filter((item) => item.content.length > 0)
          .slice(call ? -CALL_HISTORY : -40);
        if (messages.length === 0) return new Response("Nothing to answer yet.", { status: 400 });

        const encoder = new TextEncoder();
        let abortDeep: (() => void) | null = null;

        const body$ = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (payload: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            try {
              const last = messages[messages.length - 1]!;
              let quick = "";
              let deep = true;
              let quickPence = 0;

              if (call && last.role === "user") {
                const { fastTurn } = await import("@/lib/agent/fastTurn.server");
                const fast = await fastTurn(messages.slice(0, -1), last.content);
                quick = fast.reply;
                deep = fast.deep;
                quickPence = fast.usage?.pence ?? 0;
                // What she reasons from is the meaning; the panel keeps the raw words.
                last.content = fast.meaning;
                send({ type: "meaning", text: fast.meaning });
                if (quick) send({ type: "delta", text: quick });
                if (!deep) {
                  send({
                    type: "done",
                    turn: {
                      reply: quick,
                      steps: [],
                      ...(fast.usage ? { usage: fast.usage } : {}),
                    },
                  });
                  return;
                }
              }

              const { streamAgentTurn } = await import("@/lib/agent/brain.server");
              // The line she has already spoken is carried as her own words, so
              // she continues the same sentence instead of starting again.
              const carried = quick
                ? [
                    ...messages.slice(0, -1),
                    {
                      role: "assistant" as const,
                      content: `(to myself: I have just said out loud "${quick}" — carry straight on with the real result in one or two short spoken sentences, never repeat that line and never greet again.)`,
                    },
                    last,
                  ]
                : messages;
              const stream = await streamAgentTurn(
                { supabase: actor.supabase as never, userId: actor.userId },
                carried as never,
                { call },
                undefined,
                (body.context as never) ?? null,
              );
              abortDeep = stream.abort;

              for await (const delta of stream.text) {
                if (delta) send({ type: "delta", text: delta });
              }
              const turn = await stream.finish();
              send({
                type: "done",
                turn: {
                  ...turn,
                  reply: quick ? `${quick} ${turn.reply}`.trim() : turn.reply,
                  ...(turn.usage
                    ? { usage: { ...turn.usage, pence: turn.usage.pence + quickPence } }
                    : {}),
                },
              });
            } catch (error) {
              send({ type: "error", message: (error as Error).message });
            } finally {
              controller.close();
            }
          },
          // The teacher talking over her cancels the work in flight, so a
          // superseded job can never arrive late and speak over the new one.
          cancel: () => abortDeep?.(),
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
