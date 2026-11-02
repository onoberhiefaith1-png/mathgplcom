import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  addQuickIssueLink,
  createQuickIssue,
  deleteQuickIssue,
  fetchQuickIssues,
  quickIssueFileUrl,
  reopenQuickIssue,
  setQuickIssueStatus,
  uploadQuickIssueFile,
} from "@/lib/quickIssues/api";
import {
  readDisplayName,
  readLastWorked,
  writeDisplayName,
  writeLastWorked,
} from "@/lib/quickIssues/identity";
import {
  cleanActorName,
  cleanDescription,
  cleanIssueName,
  isSchoolToken,
  issueToResume,
  mediaRejection,
  parseIssueLink,
  participantCanSet,
} from "@/lib/quickIssues/model";
import { suspendChannel, resumeChannel } from "@/lib/games/audio";
import { IssueList } from "./IssueList";

const field =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50";

export default function QuickIssueTrackerPage({ token }: { token: string }) {
  const normalized = token.toLowerCase();
  const valid = isSchoolToken(normalized);
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [actor, setActor] = useState(() =>
    storage ? readDisplayName(storage) : "",
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enteredToken, setEnteredToken] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const pendingScroll = useRef<string | null>(null);
  const loadedFiles = useRef(new Set<string>());
  const nameRef = useRef<HTMLInputElement>(null);

  const board = useQuery({
    queryKey: ["quick-issues", normalized],
    enabled: valid,
    queryFn: () => fetchQuickIssues(normalized),
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? 15000
        : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    suspendChannel("global");
    return () => resumeChannel("global");
  }, []);

  useEffect(() => {
    if (!user || actor.trim()) return;
    let alive = true;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data?.display_name) setActor(data.display_name);
      });
    return () => {
      alive = false;
    };
  }, [user, actor]);

  const data = board.data;
  useEffect(() => {
    if (!data || !ready || !storage || enteredToken === normalized) return;
    const id = issueToResume(
      data.issues.map((issue) => issue.id),
      readLastWorked(normalized, user?.id ?? null, storage),
    );
    setEnteredToken(normalized);
    setExpanded(id);
    pendingScroll.current = id;
  }, [data, ready, storage, normalized, user?.id, enteredToken]);

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id || expanded !== id) return;
    pendingScroll.current = null;
    document
      .getElementById(`quick-issue-${id}`)
      ?.scrollIntoView({ block: "center" });
  }, [expanded]);

  useEffect(() => {
    const orgId = data?.canManage ? data.orgId : null;
    if (!orgId) return;
    const channel = supabase
      .channel(`quick-issues-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quick_issues",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quick_issue_media",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quick_issue_events",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.canManage, data?.orgId, normalized, qc]);

  useEffect(() => {
    const issue = data?.issues.find((item) => item.id === expanded);
    if (!issue) return;
    for (const media of issue.media) {
      if (media.kind === "link" || loadedFiles.current.has(media.id)) continue;
      loadedFiles.current.add(media.id);
      void quickIssueFileUrl(normalized, media.id)
        .then((url) =>
          setFileUrls((current) => ({ ...current, [media.id]: url })),
        )
        .catch(() => loadedFiles.current.delete(media.id));
    }
  }, [data, expanded, normalized]);

  const remember = (issueId: string) => {
    if (!storage) return;
    writeLastWorked(normalized, user?.id ?? null, storage, issueId);
  };

  const requireActor = (): string | null => {
    const cleaned = cleanActorName(actor);
    if (!cleaned) {
      setError("Enter your name so the issue shows who is working on it.");
      nameRef.current?.focus();
      return null;
    }
    if (storage) writeDisplayName(storage, cleaned);
    setActor(cleaned);
    return cleaned;
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  if (!valid) {
    return (
      <Message
        title="This school link is not active."
        body="Ask the school owner for the current link."
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg bg-background px-4 py-6 text-foreground">
      <header className="mb-5 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            MathGPL
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Issue tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.schoolName ?? "School"} · one shared list
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your name</span>
          <input
            ref={nameRef}
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            maxLength={80}
            autoComplete="name"
            className={field}
            placeholder="The name shown when you update an issue"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={primary}
            onClick={() => setReporting((open) => !open)}
          >
            {reporting ? "Close" : "Report issue"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-medium"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
        {data?.canManage && (
          <a
            href="/staff-hub"
            className="inline-block text-sm font-medium text-primary"
          >
            Back to Staff Hub
          </a>
        )}
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {reporting && (
        <form
          className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const who = requireActor();
            const title = cleanIssueName(name);
            const detail = cleanDescription(description);
            if (!who || !title || detail == null) {
              setError(
                !title
                  ? "Enter an issue name (1–140 characters)."
                  : "Check the description and try again.",
              );
              return;
            }
            const link = draftLink.trim() ? parseIssueLink(draftLink) : null;
            if (draftLink.trim() && !link) {
              setError("Enter a link starting with http:// or https://.");
              return;
            }
            for (const file of draftFiles) {
              const problem = mediaRejection(file);
              if (problem) {
                setError(problem);
                return;
              }
            }
            void run(async () => {
              const id = await createQuickIssue(normalized, title, detail, who);
              if (link)
                await addQuickIssueLink(normalized, id, link, "issue", who, "");
              for (const file of draftFiles)
                await uploadQuickIssueFile(normalized, id, file, "issue", who);
              setName("");
              setDescription("");
              setDraftLink("");
              setDraftFiles([]);
              setReporting(false);
              setExpanded(id);
              remember(id);
            });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={140}
              required
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={8000}
              rows={4}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Media</span>
            <input
              value={draftLink}
              onChange={(event) => setDraftLink(event.target.value)}
              placeholder="Link (optional)"
              className={field}
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border px-3 text-sm">
            Add file, video, screenshot, or voice file
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                setDraftFiles((current) => [...current, ...files]);
              }}
            />
          </label>
          {draftFiles.length > 0 && (
            <ul className="text-sm text-muted-foreground">
              {draftFiles.map((file) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          <button type="submit" className={primary} disabled={busy}>
            Save issue
          </button>
        </form>
      )}

      {!ready || board.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : board.isError ? (
        <Message
          title="This school link is not active."
          body={
            board.error instanceof Error
              ? board.error.message
              : "The list could not be loaded."
          }
        />
      ) : (
        <IssueList
          issues={data?.issues ?? []}
          expandedId={expanded}
          canManage={Boolean(data?.canManage)}
          busy={busy}
          fileUrls={fileUrls}
          onToggle={(id) => {
            setExpanded((current) => (current === id ? null : id));
            remember(id);
          }}
          onStatus={(id, status) => {
            const who = requireActor();
            const current = data?.issues.find((issue) => issue.id === id);
            if (!who || !current || !participantCanSet(current.status, status))
              return;
            void run(async () => {
              await setQuickIssueStatus(normalized, id, status, who);
              remember(id);
            });
          }}
          onReopen={(id, status) => {
            if (!data?.canManage) return;
            void run(async () => {
              await reopenQuickIssue(id, status);
              remember(id);
            });
          }}
          onDelete={(id) => {
            if (!data?.canManage) return;
            if (
              !window.confirm("Delete this issue? It leaves the shared list.")
            )
              return;
            void run(async () => {
              await deleteQuickIssue(id);
              if (expanded === id) setExpanded(null);
            });
          }}
          onAddLink={(id, url, role) => {
            const who = requireActor();
            const link = parseIssueLink(url);
            if (!who || !link) {
              setError("Enter a link starting with http:// or https://.");
              return;
            }
            void run(async () => {
              await addQuickIssueLink(normalized, id, link, role, who, "");
              remember(id);
            });
          }}
          onAddFile={(id, file, role) => {
            const who = requireActor();
            const problem = mediaRejection(file);
            if (!who || problem) {
              setError(
                problem ??
                  "Enter your name so the issue shows who is working on it.",
              );
              return;
            }
            void run(async () => {
              await uploadQuickIssueFile(normalized, id, file, role, who);
              remember(id);
            });
          }}
        />
      )}
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-4">
      <section className="w-full rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </section>
    </main>
  );
}
