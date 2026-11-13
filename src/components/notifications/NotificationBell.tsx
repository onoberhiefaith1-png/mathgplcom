import { Bell, CheckCheck, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CATEGORY_LABEL } from "@/lib/notifications/audience";
import {
  notificationBody,
  notificationTitle,
} from "@/lib/notifications/plainText";
import {
  notificationBodyClass,
  notificationMetaClass,
  notificationPanelClass,
  notificationTitleClass,
} from "@/components/notifications/surface";
import {
  notificationSoundEnabled,
  setNotificationSoundEnabled,
  useMarkRead,
  useNotificationList,
  useUnreadNotifications,
} from "@/lib/notifications/useNotifications";

/**
 * The one notification entry point, sitting beside the account button so it is
 * reachable from the rotating building and every workspace. Clicking opens a
 * short panel; the full centre is one click further.
 */
const NotificationBell = () => {
  const { user, ready } = useAuth();
  const { unread } = useUnreadNotifications(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(() => notificationSoundEnabled());
  const list = useNotificationList("all");
  const markRead = useMarkRead();

  if (!ready || !user) return null;

  const items = (list.data?.items ?? []).slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          className="hub-chrome relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-primary"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className={`w-[22rem] p-0 ${notificationPanelClass}`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
          <p className="text-sm font-semibold text-card-foreground">
            Notifications
            {unread > 0 && (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                {unread} unread
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={
                sound
                  ? "Turn notification sound off"
                  : "Turn notification sound on"
              }
              onClick={() => {
                const next = !sound;
                setSound(next);
                setNotificationSoundEnabled(next);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-card-foreground hover:bg-muted"
            >
              {sound ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 text-card-foreground hover:bg-muted hover:text-card-foreground"
              disabled={unread === 0}
              onClick={() => markRead.mutate({ all: true })}
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all
              read
            </Button>
          </div>
        </header>

        <ul className="max-h-96 divide-y divide-border overflow-y-auto bg-card">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/notifications/${item.id}`}
                onClick={() => setOpen(false)}
                className={`block border-l-4 px-3 py-3 transition hover:bg-muted ${
                  item.readAt
                    ? "border-l-transparent bg-card"
                    : "border-l-primary bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={notificationMetaClass}>
                    {CATEGORY_LABEL[item.category] ?? "Announcement"}
                  </span>
                  {!item.readAt && (
                    <span
                      className="h-2 w-2 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </span>
                <span className={notificationTitleClass}>
                  {notificationTitle(item.subject, item.senderName)}
                </span>
                <span className={`${notificationBodyClass} line-clamp-3`}>
                  {notificationBody(item.body)}
                </span>
              </Link>
            </li>
          ))}
          {items.length === 0 && (
            <li className="bg-card px-3 py-6 text-center text-sm text-card-foreground">
              {list.isLoading ? "Loading…" : "Nothing here yet."}
            </li>
          )}
        </ul>

        <footer className="border-t border-border bg-card px-3 py-2.5">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Open notification centre
          </Link>
        </footer>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
