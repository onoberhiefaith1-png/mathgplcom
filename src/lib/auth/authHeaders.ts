import { supabase } from "@/integrations/supabase/client";

/** Authorization header for calls to the app's own signed-in server routes. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
