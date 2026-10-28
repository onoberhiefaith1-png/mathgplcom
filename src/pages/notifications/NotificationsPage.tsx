import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Bell, CheckCheck, Megaphone, MessageSquare, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComposeNotification from "@/components/notifications/ComposeNotification";
import { useAccount } from "@/lib/accounts/useAccount";
import {
  CATEGORY_LABEL,
  NOTIFICATION_CATEGORIES,
  canSendNotifications,
  type NotificationCategory,
} from "@/lib/notifications/audience";
import {
  useMarkRead,
  useNotificationList,
  type NotificationTab,
} from "@/lib/notifications/useNotifications";
import type { NotificationItem } from "@/lib/notifications/types";

const TABS: { key: NotificationTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "questions", label: "Questions" },
  { key: "announcements", label: "Announcements" },
];

const KIND_ICON = {
  broadcast: Megaphone,
  system: Bell,
  student_question: MessageSquare,
  response: MessageSquare,
} as const;

const KIND_LABEL = {
  broadcast: "Announcement",
  system: "System notification",
  student_question: "Student question",
  response: "Response",
} as const;

const contextLine = (item: NotificationItem): string => {
  const c = item.context ?? {};
  const parts = [c.className, c.courseName, c.assignmentTitle, c.adventureTitle, c.lessonName].filter(Boolean);
  return parts.join(" · ");
};

const NotificationsPage = () => {
  const [tab, setTab] = useState<NotificationTab>("all");
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<NotificationCategory | null>(null);
  const { role } = useAccount();
  const list = useNotificationList(tab, category);
  const markRead = useMarkRead();

  const items = list.data?.items ?? [];
  const canSend = canSendNotifications(role);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Announcements, system alerts, student questions and responses — all in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => markRead.mutate({ all: true })}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read
          </Button>
          {canSend && (
            <Button asChild variant="outline" size="sm">
              <Link to="/notifications/sent">Sent</Link>
            </Button>
          )}
          {canSend && (
            <Button size="sm" className="gap-2" onClick={() => setComposing((v) => !v)}>
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              {composing ? "Close" : "Send notification"}
            </Button>
          )}
        </div>
      </header>

      {composing && canSend && role && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold text-card-foreground">New notification</h2>
          <ComposeNotification role={role} onSent={() => setComposing(false)} />
        </section>
      )}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Notification filters">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <nav className="mt-3 flex flex-wrap gap-2" aria-label="Notification categories">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${
            category === null
              ? "border-primary bg-accent text-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary"
          }`}
        >
          All categories
        </button>
        {NOTIFICATION_CATEGORIES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              category === key
                ? "border-primary bg-accent text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary"
            }`}
          >
            {CATEGORY_LABEL[key]}
          </button>
        ))}
      </nav>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind] ?? Bell;
          const unread = !item.readAt;
          return (
            <li key={item.id}>
              <Link
                to={`/notifications/${item.id}`}
                className={`flex gap-3 rounded-xl border p-3 transition hover:border-primary ${
                  unread ? "border-primary/50 bg-accent" : "border-border bg-card"
                }`}
              >
                <span className="mt-0.5 text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {KIND_LABEL[item.kind]} · {CATEGORY_LABEL[item.category]}
                    </span>
                    {unread && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  <span className="block truncate font-medium text-foreground">
                    {item.subject ?? item.senderName}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{item.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.senderName}
                    {contextLine(item) && ` · ${contextLine(item)}`} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {list.isLoading ? "Loading notifications…" : "Nothing here yet."}
          </li>
        )}
      </ul>
    </main>
  );
};

export default NotificationsPage;
