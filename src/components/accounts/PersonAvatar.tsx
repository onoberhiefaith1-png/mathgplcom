import { useEffect, useState } from "react";

import { initialsOf, signedAvatarUrl } from "@/lib/accounts/avatar";

/**
 * Another person's face, used in rosters and shared-workspace headers.
 *
 * Profile pictures live in a private bucket, so the stored value is a path and
 * a short-lived signed link is created here. When there is no picture the
 * person's initials are shown — never an email address.
 */
const PersonAvatar = ({
  name,
  avatarPath,
  size = 44,
}: {
  name: string;
  avatarPath: string | null;
  size?: number;
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!avatarPath) {
      setUrl(null);
      return () => {
        alive = false;
      };
    }
    signedAvatarUrl(avatarPath)
      .then((signed) => {
        if (alive) setUrl(signed);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [avatarPath]);

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-primary/15 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(11, size / 3) }}
    >
      {url ? (
        <img src={url} alt={`${name} profile picture`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initialsOf(name || "MathGPL")
      )}
    </span>
  );
};

export default PersonAvatar;
