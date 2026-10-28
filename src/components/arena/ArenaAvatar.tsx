// A student's picture: their uploaded photo (circular) with the emoji as fallback.
// Only our own photo endpoint is ever rendered — never an arbitrary URL.
import { useState } from "react";
import { avatarEmoji } from "@/lib/arena/ranking";
import { isArenaPhotoPath } from "@/lib/arena/photo";

type Props = {
  photo?: string | null;
  avatar?: string | null;
  name?: string;
  /** Pixel size of the circle. */
  size?: number;
  /** Gold ring, for champions. */
  ring?: boolean;
  className?: string;
};

const ArenaAvatar = ({
  photo,
  avatar,
  name = "",
  size = 36,
  ring = false,
  className = "",
}: Props) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = isArenaPhotoPath(photo) && !failed;
  return (
    <span
      aria-hidden={!name}
      title={name || undefined}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        lineHeight: 1,
        boxShadow: ring
          ? "0 0 0 2px hsl(var(--mm-accent)), 0 0 14px hsl(var(--mm-accent) / 0.55)"
          : "0 0 0 1px hsl(var(--border))",
      }}
    >
      {showPhoto ? (
        <img
          src={photo}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={name || "student"}>
          {avatarEmoji(avatar)}
        </span>
      )}
    </span>
  );
};

export default ArenaAvatar;
