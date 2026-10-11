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
  if (!ctx.isAuthenticated()) return { error: "Not authenticated" };
  const client = supabaseForUser(ctx);
  const { data: me } = await client.auth.getUser();
  if (!me.user) return { error: "Not authenticated" };
  return { client, userId: me.user.id };
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
