/**
 * Profile pictures.
 *
 * The stored value is the object *path* inside the private `avatars` bucket
 * (`<user id>/<file>`), never a URL: the bucket is private, so a short-lived
 * signed link is created when the picture is displayed.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";

export type ProfileSummary = {
  userId: string;
  displayName: string;
  firstName: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export async function signedAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function fetchProfileSummary(): Promise<ProfileSummary | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, first_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as
    | { user_id: string; display_name: string | null; first_name: string | null; avatar_url: string | null }
    | null;
  const path = row?.avatar_url ?? null;

  return {
    userId: user.id,
    displayName: row?.display_name || user.email?.split("@")[0] || "MathGPL account",
    firstName: row?.first_name ?? null,
    avatarPath: path,
    avatarUrl: await signedAvatarUrl(path),
  };
}

/** Upload (or replace) the signed-in person's profile picture. */
export async function uploadAvatar(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("not signed in");

  const extension = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${user.id}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  meterClientUsage("storage.gb_month", bytesToGb(file.size), "avatar", "GB");

  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: path }).eq("user_id", user.id);
  if (saveError) throw saveError;

  return path;
}

/** Remove the picture; the account falls back to its initials. */
export async function removeAvatar(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;
  await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
}

/** Initials shown when there is no picture. */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";
