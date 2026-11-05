import { createClient } from "@supabase/supabase-js";

/** Verify the Supabase bearer token on a server route. Returns the user id or null. */
export async function verifyRouteUser(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return String(data.claims.sub);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Please sign in to use this feature." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
