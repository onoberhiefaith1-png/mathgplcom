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

/**
 * Changes whenever caller-identity handling changes, so a live ChatGPT reply
 * shows which build answered. Non-secret.
 */
export const MCP_AUTH_BUILD = "mcp-auth-sub-v2";

export const RECONNECT_MESSAGE =
  "Your MathGPL connection has expired or was disconnected. Reconnect MathGPL in ChatGPT settings.";

export type AuthGuardReason = "no_verified_context" | "missing_subject" | "missing_token";

/** Verified caller identity from their token — never from tool input. */
export async function requireUser(
  ctx: ToolContext,
): Promise<AuthedUser | { error: string; reason: AuthGuardReason }> {
  // The MCP SDK has already verified the bearer (signature, issuer, audience,
  // OAuth client claim) before any tool runs; its `sub` is the caller. We do
  // NOT call auth.getUser(): the auth service answers ChatGPT's OAuth access
  // tokens with 403 session_not_found, which read as "Not authenticated".
  const fail = (reason: AuthGuardReason) => {
    console.warn("[mcp-auth] guard failed", { reason, build: MCP_AUTH_BUILD });
    return {
      error: `Not authenticated (${reason}; ${MCP_AUTH_BUILD}). ${RECONNECT_MESSAGE}`,
      reason,
    };
  };
  if (!ctx.isAuthenticated()) return fail("no_verified_context");
  const userId = ctx.getUserId();
  if (typeof userId !== "string" || userId.trim() === "") return fail("missing_subject");
  if (!ctx.getToken()) return fail("missing_token");
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
