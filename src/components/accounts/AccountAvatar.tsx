import { useProfileSummary } from "@/lib/accounts/useProfileSummary";
import { initialsOf } from "@/lib/accounts/avatar";

/**
 * The account's face: its uploaded picture, or its initials when none is set.
 * Used identically in the navigation, top bar, rosters and directories.
 */
const AccountAvatar = ({ size = 36 }: { size?: number }) => {
  const { avatarUrl, displayName } = useProfileSummary();

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-primary/15 text-xs font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(10, size / 3) }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName || "Profile picture"} className="h-full w-full object-cover" />
      ) : (
        initialsOf(displayName || "MathGPL")
      )}
    </span>
  );
};

export default AccountAvatar;
