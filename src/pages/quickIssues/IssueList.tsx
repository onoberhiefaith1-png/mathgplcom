import type { QuickIssue, QuickIssueMedia } from "@/lib/quickIssues/api";
import {
  STATUS_LABEL,
  historyLine,
  mediaKindLabel,
  type IssueStatus,
} from "@/lib/quickIssues/model";

const rowButton =
  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left";
const action =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 text-sm font-medium";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50";

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StoredFile({ item, url }: { item: QuickIssueMedia; url?: string }) {
  if (!url)
    return (
      <p className="text-sm text-muted-foreground">
        Loading {mediaKindLabel(item.kind).toLowerCase()}…
      </p>
    );
  if (item.kind === "image")
    return (
      <img
        src={url}
        alt={item.label || "Image"}
        className="max-h-80 w-full rounded-xl object-contain bg-muted"
      />
    );
  if (item.kind === "video")
    return <video src={url} controls className="w-full rounded-xl bg-black" />;
  if (item.kind === "audio")
    return <audio src={url} controls className="w-full" />;
  return (
    <a
      href={url}
      download={item.label || "attachment"}
      className="text-sm font-medium text-primary underline"
    >
      {item.label || "Download file"}
    </a>
  );
}

function MediaBlock({
  title,
  items,
  fileUrls,
}: {
  title: string;
  items: QuickIssueMedia[];
  fileUrls: Record<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-background p-3"
          >
            <p className="mb-2 text-xs text-muted-foreground">
              {mediaKindLabel(item.kind)}
              {item.createdByName ? ` · ${item.createdByName}` : ""}
            </p>
            {item.kind === "link" && item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary underline"
              >
                {item.label || item.url}
              </a>
            ) : (
              <StoredFile item={item} url={fileUrls[item.id]} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IssueList({
  issues,
  expandedId,
  canManage,
  busy,
  fileUrls,
  onToggle,
  onStatus,
  onReopen,
  onDelete,
  onAddLink,
  onAddFile,
}: {
  issues: QuickIssue[];
  expandedId: string | null;
  canManage: boolean;
  busy: boolean;
  fileUrls: Record<string, string>;
  onToggle: (id: string) => void;
  onStatus: (id: string, status: "in_progress" | "completed") => void;
  onReopen: (id: string, status: "in_progress" | "not_started") => void;
  onDelete: (id: string) => void;
  onAddLink: (id: string, url: string, role: "issue" | "completion") => void;
  onAddFile: (id: string, file: File, role: "issue" | "completion") => void;
}) {
  if (issues.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No issues yet. Report the first one.
      </p>
    );
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card">
      {issues.map((issue) => {
        const open = expandedId === issue.id;
        const issueMedia = issue.media.filter((item) => item.role === "issue");
        const completionMedia = issue.media.filter(
          (item) => item.role === "completion",
        );
        return (
          <li
            key={issue.id}
            id={`quick-issue-${issue.id}`}
            className="border-b border-border last:border-b-0"
          >
            <button
              type="button"
              className={rowButton}
              aria-expanded={open}
              onClick={() => onToggle(issue.id)}
            >
              <span className="min-w-0 truncate text-sm font-semibold">
                {issue.name}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {STATUS_LABEL[issue.status]}
              </span>
            </button>
            {open && (
              <div className="space-y-4 px-4 pb-4">
                {issue.description ? (
                  <p className="whitespace-pre-wrap text-sm">
                    {issue.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description.
                  </p>
                )}
                <p className="text-sm">
                  {issue.status === "in_progress" && issue.workerName
                    ? `Working on this: ${issue.workerName}`
                    : null}
                  {issue.status === "completed" && issue.completerName
                    ? `Completed by ${issue.completerName}`
                    : null}
                  {issue.status === "not_started"
                    ? `Reported by ${issue.createdByName}`
                    : null}
                </p>
                <MediaBlock
                  title="Media"
                  items={issueMedia}
                  fileUrls={fileUrls}
                />
                {issue.history.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      History
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {issue.history.map((event) => (
                        <li key={event.id}>
                          {historyLine(
                            event.action,
                            event.actorName,
                            event.toStatus as IssueStatus,
                          )}
                          <span className="text-muted-foreground">
                            {" "}
                            · {when(event.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {issue.status !== "completed" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={action}
                      disabled={busy}
                      onClick={() => onStatus(issue.id, "in_progress")}
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      className={primary}
                      disabled={busy}
                      onClick={() => onStatus(issue.id, "completed")}
                    >
                      Completed
                    </button>
                  </div>
                )}
                {issue.status === "completed" && canManage && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={action}
                      disabled={busy}
                      onClick={() => onReopen(issue.id, "in_progress")}
                    >
                      Reopen as In Progress
                    </button>
                    <button
                      type="button"
                      className={action}
                      disabled={busy}
                      onClick={() => onReopen(issue.id, "not_started")}
                    >
                      Reopen as Not Started
                    </button>
                  </div>
                )}
                <AttachmentForm
                  role="issue"
                  busy={busy}
                  onAddLink={(url) => onAddLink(issue.id, url, "issue")}
                  onAddFile={(file) => onAddFile(issue.id, file, "issue")}
                />
                {issue.status === "completed" && (
                  <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                    <h3 className="text-sm font-semibold">
                      Completion attachment
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Optional. Add a file, video, link, screenshot, or voice
                      note after this is completed.
                    </p>
                    <MediaBlock
                      title="Added after completion"
                      items={completionMedia}
                      fileUrls={fileUrls}
                    />
                    <AttachmentForm
                      role="completion"
                      busy={busy}
                      onAddLink={(url) =>
                        onAddLink(issue.id, url, "completion")
                      }
                      onAddFile={(file) =>
                        onAddFile(issue.id, file, "completion")
                      }
                    />
                  </div>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="text-sm font-medium text-destructive"
                    disabled={busy}
                    onClick={() => onDelete(issue.id)}
                  >
                    Delete issue
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AttachmentForm({
  role,
  busy,
  onAddLink,
  onAddFile,
}: {
  role: "issue" | "completion";
  busy: boolean;
  onAddLink: (url: string) => void;
  onAddFile: (file: File) => void;
}) {
  const prefix = role === "completion" ? "completion" : "issue";
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const url = String(new FormData(form).get("link") ?? "");
        if (!url.trim()) return;
        onAddLink(url);
        form.reset();
      }}
    >
      <div className="flex gap-2">
        <input
          name="link"
          placeholder="https://…"
          aria-label={role === "completion" ? "Completion link" : "Media link"}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button type="submit" className={action} disabled={busy}>
          Add link
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={action}>
          Add file, video, or screenshot
          <input
            type="file"
            className="sr-only"
            aria-label={`${prefix} file`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAddFile(file);
            }}
          />
        </label>
        <button
          type="button"
          className={action}
          disabled={busy}
          onClick={(event) => {
            const button = event.currentTarget;
            const active = recorders.get(button);
            if (active) {
              active.stop();
              return;
            }
            void startVoiceRecording(button, onAddFile).catch(
              (reason: unknown) => {
                window.alert(
                  reason instanceof Error
                    ? reason.message
                    : "Voice recording is not available in this browser.",
                );
              },
            );
          }}
        >
          Record voice
        </button>
      </div>
    </form>
  );
}

const recorders = new WeakMap<HTMLButtonElement, MediaRecorder>();

async function startVoiceRecording(
  button: HTMLButtonElement,
  onAddFile: (file: File) => void,
) {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    throw new Error("Voice recording is not available in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  rec.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    recorders.delete(button);
    button.textContent = "Record voice";
    const type = rec.mimeType || "audio/webm";
    const extension = type.includes("mp4") ? "m4a" : "webm";
    onAddFile(
      new File(
        [new Blob(chunks, { type })],
        `voice-${Date.now()}.${extension}`,
        { type },
      ),
    );
  };
  recorders.set(button, rec);
  button.textContent = "Stop recording";
  rec.start();
}
