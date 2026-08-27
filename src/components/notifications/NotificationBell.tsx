import { Bell } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUnreadNotifications } from "@/lib/notifications/useNotifications";

/**
 * The one notification entry point, sitting beside the account button so it is
 * reachable from the rotating building and every workspace.
 */
const NotificationBell = () => {
  const { user, ready } = useAuth();
  const { unread } = useUnreadNotifications(user?.id ?? null);

  if (!ready || !user) return null;

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-primary"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
};

export default NotificationBell;
