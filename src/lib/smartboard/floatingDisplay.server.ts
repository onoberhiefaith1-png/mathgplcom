import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFloatingStyle, type FloatingDisplayStyleId } from "./floatingDisplayStyles";

type Client = SupabaseClient<any, any, any>;

export interface FloatingStyleState {
  platformDefault: FloatingDisplayStyleId;
  userChoice: FloatingDisplayStyleId | null;
}

export const readPlatformStyle = async (client: Client): Promise<FloatingDisplayStyleId> => {
  const { data } = await client.from("floating_display_settings").select("style").eq("id", true).maybeSingle();
  return sanitizeFloatingStyle(data?.style);
};

export const readUserStyle = async (client: Client, userId: string): Promise<FloatingDisplayStyleId | null> => {
  const { data } = await client
    .from("user_display_preferences")
    .select("floating_display_style")
    .eq("user_id", userId)
    .maybeSingle();
  const raw = data?.floating_display_style;
  return raw ? sanitizeFloatingStyle(raw) : null;
};

export const writeUserStyle = async (client: Client, userId: string, style: FloatingDisplayStyleId) => {
  const { error } = await client
    .from("user_display_preferences")
    .upsert({ user_id: userId, floating_display_style: style }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
};

export const writePlatformStyle = async (client: Client, style: FloatingDisplayStyleId) => {
  const { error } = await client
    .from("floating_display_settings")
    .upsert({ id: true, style }, { onConflict: "id" });
  if (error) throw new Error(error.message);
};
