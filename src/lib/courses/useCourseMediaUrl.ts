import { useEffect, useState } from "react";
import { resolveCourseMedia, type CourseMediaState } from "@/lib/courses/media";

/** One state slot only — the URL and the reason travel together, so the hook
 *  shape stays stable for every caller (and across hot reloads). */
interface MediaView {
  url: string | null;
  state: CourseMediaState | "loading";
}

/** Resolves a stored path or absolute link into a displayable URL plus the
 *  reason it could not be shown (nothing set vs. no longer available). */
export const useCourseMedia = (value: string | null | undefined): MediaView => {
  const [view, setView] = useState<MediaView>({ url: null, state: value ? "loading" : "empty" });

  useEffect(() => {
    let alive = true;
    if (!value) {
      setView({ url: null, state: "empty" });
      return;
    }
    setView({ url: null, state: "loading" });
    void resolveCourseMedia(value).then((res) => {
      if (alive) setView({ url: res.url, state: res.state });
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return view;
};

/** Resolves a stored path or absolute link into a displayable URL. */
export const useCourseMediaUrl = (value: string | null | undefined) => useCourseMedia(value).url;
