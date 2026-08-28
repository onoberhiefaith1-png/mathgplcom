// Course Builder — background and video uploads.
//
// STORE ONCE → REFERENCE MANY → STREAM TO AUTHORISED VIEWERS.
//
// A file lives exactly once, under `course-media/<owner_uid>/<courseId>/…`.
// Sharing a course with a class or with MathGPL Community never copies the
// file: the course keeps the ORIGINAL path and the database decides who may
// stream it (`public.can_watch_course_media`). The owner alone may upload,
// replace or delete it; deleting it makes it unavailable everywhere at once.
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

/** How a stored reference resolved. `unavailable` means the reference exists
 *  but the original asset is gone or this viewer is not authorised — never a
 *  reason to create a copy. */
export type CourseMediaState = "empty" | "ready" | "unavailable";

export interface CourseMediaResult {
  url: string | null;
  state: CourseMediaState;
}

/** A displayable URL for a stored path, or the value itself when it is
 *  already an absolute link. The signed link streams the ORIGINAL object;
 *  authorisation is enforced by storage policy, not by copying. */
export const resolveCourseMedia = async (value: string | null): Promise<CourseMediaResult> => {
  if (!value) return { url: null, state: "empty" };
  if (/^https?:\/\//i.test(value)) return { url: value, state: "ready" };
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60 * 8);
    if (error || !data?.signedUrl) return { url: null, state: "unavailable" };
    return { url: data.signedUrl, state: "ready" };
  } catch {
    return { url: null, state: "unavailable" };
  }
};

export const courseMediaUrl = async (value: string | null): Promise<string | null> =>
  (await resolveCourseMedia(value)).url;

/** Normalised embed URL for a pasted video link. */
export const videoEmbedUrl = (url: string): string => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};
