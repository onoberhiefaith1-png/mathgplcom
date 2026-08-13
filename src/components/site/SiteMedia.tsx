import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SiteMediaResolved } from "@/lib/site/types";

interface Props {
  media?: SiteMediaResolved | null;
  className?: string;
  fit?: "cover" | "contain";
  /** The hero/LCP candidate loads eagerly; everything else is lazy. */
  priority?: boolean;
  alt?: string;
}

/**
 * One media element for the public homepage.
 *
 * Videos never autoplay off-screen: they wait for the poster to be in view,
 * so a long page of demonstrations never downloads every video at once.
 */
const SiteMedia = ({ media, className, fit = "cover", priority = false, alt = "" }: Props) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [inView, setInView] = useState(priority);

  useEffect(() => {
    if (priority || media?.mediaType !== "video") return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            void node.play().catch(() => undefined);
          } else {
            node.pause();
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [priority, media?.mediaType]);

  if (!media) return null;

  if (media.mediaType === "video") {
    return (
      <video
        ref={ref}
        src={inView ? media.url : undefined}
        poster={media.posterUrl ?? undefined}
        className={cn(className)}
        style={{ objectFit: fit }}
        preload={priority ? "auto" : "none"}
        autoPlay={priority}
        loop
        muted
        playsInline
      />
    );
  }

  return (
    <img
      src={media.url}
      alt={alt}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ fetchpriority: priority ? "high" : "auto" } as any)}
      className={cn(className)}
      style={{ objectFit: fit }}
    />
  );
};

export default SiteMedia;
