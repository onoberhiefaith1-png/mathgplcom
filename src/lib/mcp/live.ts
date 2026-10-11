import type { SupabaseClient } from "@supabase/supabase-js";

/** Send a live command to the caller's own open MathGPL windows. */
export async function sendLiveCommand(
  client: SupabaseClient,
  userId: string,
  command: string,
  payload: Record<string, unknown> = {},
): Promise<string | null> {
  const { error } = await client.from("chatgpt_commands").insert({ user_id: userId, command, payload });
  return error ? error.message : null;
}
