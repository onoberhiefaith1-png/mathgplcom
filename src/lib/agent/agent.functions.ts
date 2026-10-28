// Phase 1 — the RPC surface the agent (and the conversational UI) calls to act
// on the platform. Authentication is enforced by middleware; the teacher's own
// database client is used inside every executor.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AgentToolResult } from "./toolTypes";

type RunInput = { toolId: string; args?: Record<string, unknown> };

export const runAgentTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): RunInput => {
    const value = input as RunInput | null;
    if (!value || typeof value.toolId !== "string" || !value.toolId.trim()) {
      throw new Error("toolId is required.");
    }
    const args = value.args;
    return {
      toolId: value.toolId.trim(),
      args: args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {},
    };
  })
  .handler(async ({ data, context }): Promise<AgentToolResult> => {
    const { executeAgentTool } = await import("./tools.server");
    return executeAgentTool(
      { supabase: context.supabase as never, userId: context.userId },
      data.toolId,
      data.args ?? {},
    );
  });
