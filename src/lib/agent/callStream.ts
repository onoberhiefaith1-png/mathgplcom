// A call turn, streamed: her words arrive as they are written so her voice can
// begin on the first clause. Everything else about a turn is unchanged — same
// brain, same abilities, same conversation.

import { createParser } from "eventsource-parser";

import { supabase } from "@/integrations/supabase/client";

import type { AgentTurn } from "./brain.server";
import type { AuraPlatformContext } from "./context";

export type CallTurnRequest = {
  messages: { role: "user" | "assistant"; content: string }[];
  context: AuraPlatformContext | null;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
};

export async function streamCallTurn({
  messages,
  context,
  onDelta,
  signal,
}: CallTurnRequest): Promise<AgentTurn> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to keep talking to me.");

  const response = await fetch("/api/aura-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, context, call: true }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      response.status === 401
        ? "Sign in again to keep talking to me."
        : "I couldn't finish that just now. Try me again in a moment.",
    );
  }

  let turn: AgentTurn | null = null;
  let failure: string | null = null;
  const parser = createParser({
    onEvent(event) {
      const payload = JSON.parse(event.data) as {
        type?: string;
        text?: string;
        message?: string;
        turn?: AgentTurn;
      };
      if (payload.type === "delta" && payload.text) onDelta(payload.text);
      else if (payload.type === "done" && payload.turn) turn = payload.turn;
      else if (payload.type === "error") failure = payload.message ?? "Something went wrong.";
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      parser.feed(next.value);
    }
    parser.reset({ consume: true });
  } finally {
    reader.releaseLock();
  }

  if (failure) throw new Error(failure);
  if (!turn) throw new Error("I couldn't finish that just now. Try me again in a moment.");
  return turn;
}
