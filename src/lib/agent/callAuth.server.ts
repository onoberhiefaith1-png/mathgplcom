// The signed-in teacher, established from the request's own bearer token, so a
// streaming route can act as them under row-level security exactly like a
// server function does.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function supabaseFetch(key: string): typeof fetch {
  const opaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (opaque && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export type RequestActor = {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
};

/** Null when the caller is not signed in — the route answers 401 in that case. */
export async function actorFromRequest(request: Request): Promise<RequestActor | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("The backend is not configured yet.");

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return null;

  const supabase = createClient<Database>(url, key, {
    global: { fetch: supabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId };
}
