// A Session / Sub-Session cover. Covers stored in the official bucket are kept
// as "storage:<path>"; anything else is a plain URL.

import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { cn } from "@/lib/utils";

export const STORAGE_PREFIX = "storage:";

interface Props {
  value?: string | null;
  icon?: string | null;
  name: string;
  className?: string;
}

const FolderCover = ({ value, icon, name, className }: Props) => {
  if (value?.startsWith(STORAGE_PREFIX)) {
    return (
      <SignedMedia
        path={value.slice(STORAGE_PREFIX.length)}
        mediaType="image"
        fit="cover"
        alt={name}
        className={cn("h-full w-full", className)}
      />
    );
  }
  if (value) {
    return (
      <img
        src={value}
        alt={name}
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)}>
      <span className="text-4xl leading-none">{icon || "📁"}</span>
    </div>
  );
};

export default FolderCover;
