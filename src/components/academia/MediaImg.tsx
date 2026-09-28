import { useQuery } from "@tanstack/react-query";
import { mediaUrl } from "@/lib/academia/api";

/** A private Academia picture, shown through a short-lived signed link. */
const MediaImg = ({ path, alt = "", className, fallback }: { path: string | null | undefined; alt?: string; className?: string; fallback?: React.ReactNode }) => {
  const q = useQuery({ queryKey: ["academia-media", path], enabled: !!path, staleTime: 40 * 60_000, queryFn: () => mediaUrl(path) });
  if (!path || !q.data) return <>{fallback ?? null}</>;
  return <img src={q.data} alt={alt} className={className} loading="lazy" />;
};
export default MediaImg;
