// Phase 2 — the RPC surface the teacher's screen talks to: one conversational
// turn, and the proactive greeting shown on arrival.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AgentStep, AgentTurn } from "./brain.server";

export type AgentChatMessage = { role: "user" | "assistant"; content: string };
export type { AgentStep, AgentTurn };

const MAX_HISTORY = 40;

function parseMessages(input: unknown): AgentChatMessage[] {
  const raw = (input as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw)) throw new Error("messages is required.");
  const out: AgentChatMessage[] = [];
  for (const item of raw) {
    const m = item as { role?: unknown; content?: unknown };
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = typeof m?.content === "string" ? m.content.trim() : "";
    if (content) out.push({ role, content });
  }
  if (out.length === 0) throw new Error("Nothing to answer yet.");
  return out.slice(-MAX_HISTORY);
}

export const agentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ messages: parseMessages(input) }))
  .handler(async ({ data, context }): Promise<AgentTurn> => {
    const { runAgentTurn } = await import("./brain.server");
    return runAgentTurn(
      { supabase: context.supabase as never, userId: context.userId },
      data.messages,
    );
  });

export const agentGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ greeting: string }> => {
    const { runAgentGreeting } = await import("./brain.server");
    return runAgentGreeting({ supabase: context.supabase as never, userId: context.userId });
  });
