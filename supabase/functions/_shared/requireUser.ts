import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** Verifies the caller's sign-in. Returns the user id, or a 401 Response. */
export async function requireUser(req: Request): Promise<string | Response> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const deny = () =>
    new Response(JSON.stringify({ error: "Please sign in to use this feature." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (!token) return deny();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return deny();
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || !sub || data?.claims?.role !== "authenticated") return deny();
  return String(sub);
}
