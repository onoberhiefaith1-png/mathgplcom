import { useEffect, useState } from "react";
import { courseMediaUrl } from "@/lib/courses/media";

/** Resolves a stored path or absolute link into a displayable URL. */
export const useCourseMediaUrl = (value: string | null | undefined) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) {
      setUrl(null);
      return;
    }
    void courseMediaUrl(value).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  return url;
};
