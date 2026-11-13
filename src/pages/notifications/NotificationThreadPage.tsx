import { useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, ExternalLink, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useNotificationThread,
  useRespond,
} from "@/lib/notifications/useNotifications";
import { CATEGORY_LABEL } from "@/lib/notifications/audience";
import {
  notificationBody,
  notificationContextSentence,
  notificationRoleLabel,
  notificationTitle,
} from "@/lib/notifications/plainText";
import {
  notificationMessageClass,
  notificationMetaClass,
  notificationPanelClass,
} from "@/components/notifications/surface";
import type { NotificationItem } from "@/lib/notifications/types";

const ContextCard = ({ item }: { item: NotificationItem }) => {
  const sentence = notificationContextSentence(item.context);
  if (!sentence) return null;
  return (
    <p
      className={`rounded-lg border px-3 py-2.5 text-sm leading-6 ${notificationPanelClass}`}
    >
      {sentence}
    </p>
  );
};

const Message = ({ item }: { item: NotificationItem }) => {
  const role = notificationRoleLabel(item.senderRole);
  return (
    <article
      className={`rounded-xl border p-4 ${notificationPanelClass} ${item.mine ? "border-primary" : "border-border"}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-card-foreground">
          {item.mine ? "You" : item.senderName}
          {role && (
            <span className={`ml-2 ${notificationMetaClass}`}>{role}</span>
          )}
        </h2>
        <time className={notificationMetaClass}>
          {new Date(item.createdAt).toLocaleString()}
        </time>
      </header>
      {item.kind !== "response" && (
        <p className={`mt-1 ${notificationMetaClass}`}>
          {CATEGORY_LABEL[item.category]}
        </p>
      )}
      {item.subject && item.kind !== "response" && (
        <p className="mt-1 text-base font-semibold leading-6 text-card-foreground">
          {notificationTitle(item.subject, item.senderName)}
        </p>
      )}
      <p className={notificationMessageClass}>{notificationBody(item.body)}</p>
      {item.attachment && (
        <a
          href={item.attachment.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          {item.attachment.name ?? "Attachment"}
        </a>
      )}
    </article>
  );
};

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
      <Link
        to="/notifications"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Notifications
      </Link>

      {thread.isLoading && (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      )}
      {thread.isError && (
        <p className="mt-6 text-sm text-destructive">
          This notification could not be opened.
        </p>
      )}

      {root && (
        <div className="mt-4 space-y-3">
          <Message item={root} />
          <ContextCard item={root} />
          {root.targetPath && (
            <Link
              to={root.targetPath}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> View in
              context
            </Link>
          )}

          {replies.map((item) => (
            <Message key={item.id} item={item} />
          ))}

          {thread.data?.engagement && (
            <p
              className={`rounded-xl border p-3 text-sm leading-6 ${notificationPanelClass}`}
            >
              {thread.data.engagement.recipients} recipient
              {thread.data.engagement.recipients === 1 ? "" : "s"} ·{" "}
              {thread.data.engagement.read} read ·{" "}
              {thread.data.engagement.responded} responded
            </p>
          )}

          {!root.allowResponses && (
            <p className="rounded-xl border border-border bg-muted p-3 text-sm leading-6 text-card-foreground">
              This notification does not accept responses.
            </p>
          )}

          {root.allowResponses && (
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
              <label
                className="text-sm font-medium text-card-foreground"
                htmlFor="notification-reply"
              >
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
                <Button
                  type="submit"
                  size="sm"
                  className="gap-2"
                  disabled={respond.isPending || !reply.trim()}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {respond.isPending ? "Sending…" : "Send response"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </main>
  );
};

export default NotificationThreadPage;
