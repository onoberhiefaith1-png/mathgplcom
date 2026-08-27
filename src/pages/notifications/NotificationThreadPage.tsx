import { useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNotificationThread, useRespond } from "@/lib/notifications/useNotifications";
import type { NotificationItem } from "@/lib/notifications/types";

const ContextCard = ({ item }: { item: NotificationItem }) => {
  const c = item.context ?? {};
  const rows: [string, string | null | undefined][] = [
    ["School", c.orgName],
    ["Class", c.className],
    ["Course", c.courseName],
    ["Assignment", c.assignmentTitle],
    ["Adventure", c.adventureTitle],
    ["Lesson", c.lessonName],
    ["Question", c.boardQuestionId],
    ["Source", c.source],
  ];
  const present = rows.filter(([, value]) => !!value);
  if (present.length === 0) return null;
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-lg border border-border bg-background p-3 text-sm sm:grid-cols-2">
      {present.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

const Message = ({ item }: { item: NotificationItem }) => (
  <article className={`rounded-xl border p-4 ${item.mine ? "border-primary/40 bg-accent" : "border-border bg-card"}`}>
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">
        {item.mine ? "You" : item.senderName}
        {item.senderRole && <span className="ml-2 text-xs font-normal text-muted-foreground">{item.senderRole}</span>}
      </h2>
      <time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time>
    </header>
    {item.subject && item.kind !== "response" && (
      <p className="mt-1 text-base font-medium text-foreground">{item.subject}</p>
    )}
    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
  </article>
);

/** A notification and its responses — a short thread, not a chat room. */
const NotificationThreadPage = () => {
  const { notificationId } = useParams<{ notificationId: string }>();
  const thread = useNotificationThread(notificationId ?? "");
  const respond = useRespond(notificationId ?? undefined);
  const [reply, setReply] = useState("");

  const root = thread.data?.root;
  const replies = thread.data?.replies ?? [];
  const last = replies.length > 0 ? replies[replies.length - 1]! : root;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link to="/notifications" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Notifications
      </Link>

      {thread.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {thread.isError && <p className="mt-6 text-sm text-destructive">This notification could not be opened.</p>}

      {root && (
        <div className="mt-4 space-y-3">
          <Message item={root} />
          <ContextCard item={root} />
          {root.targetPath && (
            <Link
              to={root.targetPath}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> View in context
            </Link>
          )}

          {replies.map((item) => (
            <Message key={item.id} item={item} />
          ))}

          <form
            className="rounded-xl border border-border bg-card p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!last) return;
              if (reply.trim().length === 0) return;
              respond.mutate(
                { messageId: last.id, body: reply },
                {
                  onSuccess: () => {
                    setReply("");
                    toast.success("Response sent.");
                  },
                  onError: (error: Error) => toast.error(error.message),
                },
              );
            }}
          >
            <label className="text-sm font-medium text-card-foreground" htmlFor="notification-reply">
              Respond
            </label>
            <Textarea
              id="notification-reply"
              value={reply}
              rows={3}
              maxLength={4000}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write your response…"
              className="mt-2"
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" className="gap-2" disabled={respond.isPending || !reply.trim()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {respond.isPending ? "Sending…" : "Send response"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default NotificationThreadPage;
