// Course Builder — background and video uploads. Files live under
// `course-media/<uid>/…` so storage RLS keeps each teacher inside their own
// folder. The bucket is private, so display URLs are signed.
import { supabase } from "@/integrations/supabase/client";
import { bytesToGb, meterClientUsage } from "@/lib/costs/clientMeter";

const BUCKET = "course-media";

export const uploadCourseMedia = async (courseId: string, file: File): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_signed_in");
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${uid}/${courseId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  meterClientUsage("storage.gb_month", bytesToGb(file.size), "course-media", "GB");
  return path;
};

/** A displayable URL for a stored path, or the value itself when it is
 *  already an absolute link. */
export const courseMediaUrl = async (value: string | null): Promise<string | null> => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60 * 8);
  return data?.signedUrl ?? null;
};

/** Normalised embed URL for a pasted video link. */
export const videoEmbedUrl = (url: string): string => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};
