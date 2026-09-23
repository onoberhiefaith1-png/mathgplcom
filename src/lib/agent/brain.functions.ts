// Phase 2 — the RPC surface the teacher's screen talks to: one conversational
// turn, and the proactive greeting shown on arrival.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AgentStep, AgentTurn } from "./brain.server";
import type { AuraPlatformContext } from "./context";

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

/**
 * Where the teacher is standing when they speak. Kept deliberately permissive:
 * a screen that reports nothing simply leaves Aura where she was before.
 */
function parseContext(input: unknown): AuraPlatformContext | null {
  const raw = (input as { context?: unknown } | null)?.context;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "string" || typeof value === "number") out[key] = value;
    else if (Array.isArray(value)) {
      const strings = value.filter((v): v is string => typeof v === "string" && v.length > 0);
      if (strings.length) out[key] = strings.slice(0, 24);
    }
  }
  return Object.keys(out).length ? (out as AuraPlatformContext) : null;
}

export const agentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    messages: parseMessages(input),
    context: parseContext(input),
  }))
  .handler(async ({ data, context }): Promise<AgentTurn> => {
    const { runAgentTurn } = await import("./brain.server");
    return runAgentTurn(
      { supabase: context.supabase as never, userId: context.userId },
      data.messages,
      undefined,
      data.context,
    );
  });

export const agentGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ greeting: string }> => {
    const { runAgentGreeting } = await import("./brain.server");
    return runAgentGreeting({ supabase: context.supabase as never, userId: context.userId });
  });
