import { ChevronDown, ExternalLink, Film, Image as ImageIcon, Link2, Mic, Paperclip } from "lucide-react";
import type { QuickIssue, QuickIssueMedia } from "@/lib/quickIssues/api";
import {
  STATUS_LABEL,
  historyLine,
  mediaKindLabel,
  type IssueStatus,
  type MediaKind,
} from "@/lib/quickIssues/model";
import { crest, eyebrow, field, paper, primary, quiet } from "./surface";

const chip: Record<IssueStatus, string> = {
  not_started: "bg-dash-navy/[0.06] text-dash-surface-muted ring-1 ring-inset ring-dash-border",
  in_progress: "bg-dash-gold/25 text-dash-navy ring-1 ring-inset ring-dash-gold/55",
  completed: "bg-success/15 text-success ring-1 ring-inset ring-success/30",
};

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function KindIcon({ kind }: { kind: MediaKind }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (kind === "link") return <Link2 className={className} aria-hidden />;
  if (kind === "image") return <ImageIcon className={className} aria-hidden />;
  if (kind === "video") return <Film className={className} aria-hidden />;
  if (kind === "audio") return <Mic className={className} aria-hidden />;
  return <Paperclip className={className} aria-hidden />;
}

function StoredFile({ item, url }: { item: QuickIssueMedia; url?: string }) {
  if (!url)
    return (
      <p className="text-sm text-dash-surface-muted">
        Loading {mediaKindLabel(item.kind).toLowerCase()}…
      </p>
    );
  if (item.kind === "image")
    return (
      <img
        src={url}
        alt={item.label || "Image"}
        className="max-h-80 w-full rounded-lg border border-dash-border bg-dash-navy/[0.03] object-contain"
      />
    );
  if (item.kind === "video")
    return (
      <video
        src={url}
        controls
        className="w-full rounded-lg border border-dash-border bg-dash-navy"
      />
    );
  if (item.kind === "audio")
    return (
      <div className="rounded-lg border border-dash-border bg-dash-navy/[0.03] px-3 py-2">
        <audio src={url} controls className="w-full" />
      </div>
    );
  return (
    <a
      href={url}
      download={item.label || "attachment"}
      className="inline-flex items-center gap-2 text-sm font-medium text-dash-navy underline decoration-dash-gold/70 underline-offset-4"
    >
      <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
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
      <h3 className={eyebrow}>{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-dash-border bg-dash-surface p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-dash-surface-muted">
              <KindIcon kind={item.kind} />
              {mediaKindLabel(item.kind)}
              {item.createdByName ? ` · ${item.createdByName}` : ""}
            </p>
            {item.kind === "link" && item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-2 break-all text-sm font-medium text-dash-navy underline decoration-dash-gold/70 underline-offset-4"
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
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

function statusLine(issue: QuickIssue): string | null {
  if (issue.status === "in_progress" && issue.workerName)
    return `Working on this: ${issue.workerName}`;
  if (issue.status === "completed" && issue.completerName)
    return `Completed by ${issue.completerName}`;
  if (issue.status === "not_started") return `Reported by ${issue.createdByName}`;
  return null;
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
      <section className="rounded-2xl border border-dashed border-dash-border bg-dash-surface px-6 py-14 text-center shadow-[var(--shadow-dash)]">
        <p className={eyebrow}>Shared list</p>
        <p className="mt-2 text-sm text-dash-surface-muted">No issues yet. Report the first one.</p>
      </section>
    );
  }
  return (
    <section className={paper}>
      <div className={crest} />
      <p className={`${eyebrow} px-4 pt-4`}>
        {issues.length === 1 ? "1 issue" : `${issues.length} issues`}
      </p>
      <ul>
        {issues.map((issue) => {
          const open = expandedId === issue.id;
          const issueMedia = issue.media.filter((item) => item.role === "issue");
          const completionMedia = issue.media.filter((item) => item.role === "completion");
          const who = statusLine(issue);
          return (
            <li
              key={issue.id}
              id={`quick-issue-${issue.id}`}
              className="scroll-mt-4 border-b border-dash-border last:border-b-0"
            >
              <button
                type="button"
                className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-dash-navy/[0.03] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dash-gold ${open ? "bg-dash-navy/[0.03]" : ""}`}
                aria-expanded={open}
                onClick={() => onToggle(issue.id)}
              >
                <span className={`min-w-0 flex-1 text-sm font-semibold text-dash-navy ${open ? "break-words" : "truncate"}`}>
                  {issue.name}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip[issue.status]}`}>
                    {STATUS_LABEL[issue.status]}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-dash-surface-muted transition ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </span>
              </button>
              {open && (
                <div className="space-y-4 border-t border-dash-border bg-[hsl(214_80%_99%)] px-4 py-4">
                  {issue.description ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{issue.description}</p>
                  ) : (
                    <p className="text-sm text-dash-surface-muted">No description.</p>
                  )}
                  {who ? <p className="text-sm font-medium text-dash-navy">{who}</p> : null}
                  <MediaBlock title="Media" items={issueMedia} fileUrls={fileUrls} />
                  {issue.history.length > 0 && (
                    <div>
                      <h3 className={eyebrow}>History</h3>
                      <ul className="mt-2 space-y-1.5 border-l border-dash-border pl-3 text-sm">
                        {issue.history.map((event) => (
                          <li key={event.id}>
                            {historyLine(event.action, event.actorName, event.toStatus as IssueStatus)}
                            <span className="text-dash-surface-muted"> · {when(event.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {issue.status !== "completed" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={quiet}
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
                        className={quiet}
                        disabled={busy}
                        onClick={() => onReopen(issue.id, "in_progress")}
                      >
                        Reopen as In Progress
                      </button>
                      <button
                        type="button"
                        className={quiet}
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
                    <div className="space-y-3 rounded-xl border border-dash-gold/40 bg-dash-gold/10 p-3">
                      <h3 className="text-sm font-semibold text-dash-navy">Completion attachment</h3>
                      <p className="text-xs text-dash-surface-muted">
                        Optional. Add a file, video, link, screenshot, or voice note after this is completed.
                      </p>
                      <MediaBlock title="Added after completion" items={completionMedia} fileUrls={fileUrls} />
                      <AttachmentForm
                        role="completion"
                        busy={busy}
                        onAddLink={(url) => onAddLink(issue.id, url, "completion")}
                        onAddFile={(file) => onAddFile(issue.id, file, "completion")}
                      />
                    </div>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="text-sm font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-50"
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
    </section>
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
      <p className={eyebrow}>{role === "completion" ? "Add a completion link" : "Add media"}</p>
      <div className="flex gap-2">
        <input
          name="link"
          placeholder="https://…"
          aria-label={role === "completion" ? "Completion link" : "Media link"}
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" className={quiet} disabled={busy}>
          Add link
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={`${quiet} max-w-full text-center`}>
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
          className={quiet}
          disabled={busy}
          onClick={(event) => {
            const button = event.currentTarget;
            const active = recorders.get(button);
            if (active) {
              active.stop();
              return;
            }
            void startVoiceRecording(button, onAddFile).catch((reason: unknown) => {
              window.alert(
                reason instanceof Error
                  ? reason.message
                  : "Voice recording is not available in this browser.",
              );
            });
          }}
        >
          Record voice
        </button>
      </div>
    </form>
  );
}

const recorders = new WeakMap<HTMLButtonElement, MediaRecorder>();

async function startVoiceRecording(button: HTMLButtonElement, onAddFile: (file: File) => void) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
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
      new File([new Blob(chunks, { type })], `voice-${Date.now()}.${extension}`, { type }),
    );
  };
  recorders.set(button, rec);
  button.textContent = "Stop recording";
  rec.start();
}
