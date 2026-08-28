import { useEffect, useState } from "react";
import { resolveCourseMedia, type CourseMediaState } from "@/lib/courses/media";

/** Resolves a stored path or absolute link into a displayable URL plus the
 *  reason it could not be shown (nothing set vs. no longer available). */
export const useCourseMedia = (value: string | null | undefined) => {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<CourseMediaState | "loading">(value ? "loading" : "empty");

  useEffect(() => {
    let alive = true;
    if (!value) {
      setUrl(null);
      setState("empty");
      return;
    }
    setState("loading");
    void resolveCourseMedia(value).then((res) => {
      if (!alive) return;
      setUrl(res.url);
      setState(res.state);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return { url, state };
};

/** Resolves a stored path or absolute link into a displayable URL. */
export const useCourseMediaUrl = (value: string | null | undefined) => useCourseMedia(value).url;
