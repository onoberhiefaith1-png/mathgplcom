/**
 * Community profile media — profile photo, cover image or video, and the
 * introduction video.
 *
 * Teachers upload these files; nobody types a link. The stored value is the
 * object *path* inside the `community-media` bucket (`<uid>/<kind>-<time>.<ext>`),
 * and a short-lived signed link is created when the media is displayed.
 * Values that are already absolute links are passed through untouched.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { bytesToGb, meterClientUsage } from "@/lib/costs/clientMeter";

const BUCKET = "community-media";

export type CommunityMediaKind = "photo" | "cover" | "intro";

const extensionOf = (name: string) => (name.split(".").pop() || "bin").toLowerCase();

const isAbsolute = (value: string) => /^https?:\/\//i.test(value);

/** Upload one piece of profile media and return the stored path. */
export async function uploadCommunityMedia(file: File, kind: CommunityMediaKind): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not signed in");

  const path = `${uid}/${kind}-${Date.now()}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;

  meterClientUsage("storage.gb_month", bytesToGb(file.size), `community-${kind}`, "GB");
  return path;
}

/** Delete a stored file. Absolute links and empty values are ignored. */
export async function removeCommunityMedia(value: string): Promise<void> {
  const path = value.trim();
  if (!path || isAbsolute(path)) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/** A displayable link for a stored path. */
export async function communityMediaUrl(value: string | null): Promise<string | null> {
  const path = value?.trim();
  if (!path) return null;
  if (isAbsolute(path)) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 8);
  return data?.signedUrl ?? null;
}

/** React helper: resolve a stored path to a link that can be rendered. */
export const useCommunityMediaUrl = (value: string | null | undefined) => {
  const path = value?.trim() || "";
  const query = useQuery({
    queryKey: ["community-media-url", path],
    enabled: Boolean(path),
    staleTime: 30 * 60_000,
    queryFn: () => communityMediaUrl(path),
  });
  if (!path) return null;
  if (isAbsolute(path)) return path;
  return query.data ?? null;
};
