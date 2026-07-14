import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/games/urls";
import type { MediaSource, MediaType } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export const useSignedUrl = (path?: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
};

interface SignedMediaProps {
  path?: string | null;
  mediaType: MediaType;
  source?: MediaSource;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
  loop?: boolean;
  muted?: boolean;
}

const SignedMedia = ({
  path,
  mediaType,
  source = "storage",
  alt = "",
  className,
  fit = "contain",
  loop = true,
  muted = true,
}: SignedMediaProps) => {
  const signed = useSignedUrl(source === "storage" ? path : null);
  const url = source === "url" ? path ?? null : signed;
  if (!url) {
    return <div className={cn("animate-pulse bg-muted/40", className)} aria-hidden />;
  }
  if (mediaType === "video") {
    return (
      <video
        src={url}
        className={className}
        style={{ objectFit: fit }}
        autoPlay
        loop={loop}
        muted={muted}
        playsInline
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={className}
      style={{ objectFit: fit }}
    />
  );
};

export default SignedMedia;
