import { ArrowLeft } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useAccount } from "@/lib/accounts/useAccount";
import { CATEGORY_LABEL, canSendNotifications } from "@/lib/notifications/audience";
import { useNotificationStats, useSentNotifications } from "@/lib/notifications/useNotifications";

const percent = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

/** What this account has sent, and how it landed. */
const SentNotificationsPage = () => {
  const { role } = useAccount();
  const allowed = canSendNotifications(role);
  const sent = useSentNotifications(allowed);
  const stats = useNotificationStats(allowed);

  const items = sent.data?.items ?? [];
  const totals = stats.data;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        to="/notifications"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Notifications
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Sent notifications</h1>
      <p className="text-sm text-muted-foreground">
        Every notification this account has sent, with how many people received, read and answered it.
      </p>

      {!allowed && (
        <p className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          This account does not send notifications.
        </p>
      )}

      {allowed && (
        <>
          <dl className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ["Sent", totals?.sent ?? 0],
              ["Delivered", totals?.delivered ?? 0],
              ["Read", totals?.read ?? 0],
              ["Responses", totals?.responded ?? 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-card-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-6 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABEL[item.category]} · {item.audienceLabel}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                <Link
                  to={`/notifications/${item.id}`}
                  className="mt-1 block font-medium text-foreground hover:underline"
                >
                  {item.subject ?? "Notification"}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.recipients} recipient{item.recipients === 1 ? "" : "s"} · {item.read} read (
                  {percent(item.read, item.recipients)}) · {item.responded} responded
                </p>
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {sent.isLoading ? "Loading…" : "Nothing sent yet."}
              </li>
            )}
          </ul>
        </>
      )}
    </main>
  );
};

export default SentNotificationsPage;
