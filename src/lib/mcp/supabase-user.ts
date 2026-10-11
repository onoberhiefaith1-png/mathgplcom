import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** A Supabase client that acts as the signed-in caller (RLS applies). */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export type AuthedUser = { client: SupabaseClient; userId: string };

/** Verified caller identity from their token — never from tool input. */
export async function requireUser(
  ctx: ToolContext,
): Promise<AuthedUser | { error: string }> {
  // The MCP SDK has already verified the bearer (signature, issuer, audience,
  // OAuth client claim) before any tool runs; its `sub` is the caller. A second
  // auth round-trip only added a failure point that read as "Not authenticated".
  if (!ctx.isAuthenticated()) return { error: "Not authenticated" };
  const userId = ctx.getUserId();
  if (typeof userId !== "string" || userId.trim() === "" || !ctx.getToken()) {
    return { error: "Not authenticated" };
  }
  // The client still carries the caller's own token, so row rules apply.
  return { client: supabaseForUser(ctx), userId };
}

export function err(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function ok(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}
