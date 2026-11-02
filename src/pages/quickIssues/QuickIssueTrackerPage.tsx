import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
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
import {
  CardPreview,
  PREVIEW_OPEN_ID,
  previewFileUrls,
  previewIssues,
  readPreview,
} from "./devPreview";
import { crest, desk, DESK_COLOR, DESK_INK, eyebrow, field, paper, primary, quiet } from "./surface";

export default function QuickIssueTrackerPage({ token }: { token: string }) {
  const preview = readPreview();
  const normalized = token.toLowerCase();
  const valid = isSchoolToken(normalized);
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [actor, setActor] = useState(() => (storage ? readDisplayName(storage) : ""));
  const [expanded, setExpanded] = useState<string | null>(() =>
    preview === "issues" ? PREVIEW_OPEN_ID : null,
  );
  const [reporting, setReporting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enteredToken, setEnteredToken] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>(() =>
    preview === "issues" ? previewFileUrls() : {},
  );
  const pendingScroll = useRef<string | null>(null);
  const loadedFiles = useRef(new Set<string>());
  const nameRef = useRef<HTMLInputElement>(null);
  const issueNameRef = useRef<HTMLInputElement>(null);

  const board = useQuery({
    queryKey: ["quick-issues", normalized],
    enabled: valid && preview == null,
    queryFn: () => fetchQuickIssues(normalized),
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible" ? 15000 : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    suspendChannel("global");
    return () => resumeChannel("global");
  }, []);

  useEffect(() => {
    if (preview === "card") return;
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootBg: root.style.backgroundColor,
      bodyBg: body.style.backgroundColor,
      bodyColor: body.style.color,
      scheme: root.style.colorScheme,
    };
    root.style.backgroundColor = DESK_COLOR;
    body.style.backgroundColor = DESK_COLOR;
    body.style.color = DESK_INK;
    root.style.colorScheme = "light";
    return () => {
      root.style.backgroundColor = previous.rootBg;
      body.style.backgroundColor = previous.bodyBg;
      body.style.color = previous.bodyColor;
      root.style.colorScheme = previous.scheme;
    };
  }, [preview]);

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

  const live = board.data;
  const data =
    preview === "issues" || preview === "empty"
      ? {
          schoolName: "Northgate",
          canManage: true,
          orgId: null,
          issues: preview === "empty" ? [] : previewIssues(),
        }
      : live;

  useEffect(() => {
    if (preview || !data || !ready || !storage || enteredToken === normalized) return;
    const id = issueToResume(
      data.issues.map((issue) => issue.id),
      readLastWorked(normalized, user?.id ?? null, storage),
    );
    setEnteredToken(normalized);
    setExpanded(id);
    pendingScroll.current = id;
  }, [data, ready, storage, normalized, user?.id, enteredToken, preview]);

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id || expanded !== id) return;
    pendingScroll.current = null;
    document.getElementById(`quick-issue-${id}`)?.scrollIntoView({ block: "center" });
  }, [expanded]);

  useEffect(() => {
    if (preview) return;
    const orgId = data?.canManage ? data.orgId : null;
    if (!orgId) return;
    const channel = supabase
      .channel(`quick-issues-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quick_issues", filter: `org_id=eq.${orgId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quick_issue_media", filter: `org_id=eq.${orgId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quick_issue_events", filter: `org_id=eq.${orgId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["quick-issues", normalized] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.canManage, data?.orgId, normalized, qc, preview]);

  useEffect(() => {
    if (preview) return;
    const issue = data?.issues.find((item) => item.id === expanded);
    if (!issue) return;
    for (const media of issue.media) {
      if (media.kind === "link" || loadedFiles.current.has(media.id)) continue;
      loadedFiles.current.add(media.id);
      void quickIssueFileUrl(normalized, media.id)
        .then((url) => setFileUrls((current) => ({ ...current, [media.id]: url })))
        .catch(() => loadedFiles.current.delete(media.id));
    }
  }, [data, expanded, normalized, preview]);

  useEffect(() => {
    if (reporting) issueNameRef.current?.focus();
  }, [reporting]);

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

  if (preview === "card") return <CardPreview />;

  if (!valid && preview == null) {
    return (
      <Message
        title="This school link is not active."
        body="Ask the school owner for the current link."
      />
    );
  }

  const showLoading = preview == null && (!ready || board.isLoading);

  return (
    <main className={`${desk} px-4 py-8 sm:px-6 sm:py-12`}>
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className={paper}>
          <div className={crest} />
          <div className="space-y-5 px-5 py-5">
            <div>
              <p className={eyebrow}>MathGPL</p>
              <h1 className="mt-1 font-display text-3xl leading-tight text-dash-navy">Issue tracker</h1>
              <p className="mt-1 text-sm text-dash-surface-muted">
                {data?.schoolName ?? "School"} · one shared list
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-dash-navy">Your name</span>
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
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => setReporting((open) => !open)}>
                {reporting ? "Close" : "Report issue"}
              </button>
              <button type="button" className={quiet} onClick={() => void refresh()}>
                {board.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                Refresh
              </button>
            </div>
            {data?.canManage && (
              <a href="/staff-hub" className="inline-block text-sm font-medium text-dash-navy underline-offset-4 hover:underline">
                Back to Staff Hub
              </a>
            )}
          </div>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {reporting && (
          <form
            className={paper}
            onSubmit={(event) => {
              event.preventDefault();
              const who = requireActor();
              const title = cleanIssueName(name);
              const detail = cleanDescription(description);
              if (!who || !title || detail == null) {
                setError(!title ? "Enter an issue name (1–140 characters)." : "Check the description and try again.");
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
                if (link) await addQuickIssueLink(normalized, id, link, "issue", who, "");
                for (const file of draftFiles) await uploadQuickIssueFile(normalized, id, file, "issue", who);
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
            <div className={crest} />
            <div className="space-y-3 px-5 py-5">
              <h2 className="font-display text-2xl text-dash-navy">New issue</h2>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-dash-navy">Name</span>
                <input
                  ref={issueNameRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={140}
                  required
                  className={field}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-dash-navy">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={8000}
                  rows={4}
                  className={field}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-dash-navy">Media</span>
                <input
                  value={draftLink}
                  onChange={(event) => setDraftLink(event.target.value)}
                  placeholder="Link (optional)"
                  className={field}
                />
              </label>
              <label className={`${quiet} max-w-full text-center`}>
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
                <ul className="space-y-1 text-sm text-dash-surface-muted">
                  {draftFiles.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                  ))}
                </ul>
              )}
              <button type="submit" className={primary} disabled={busy}>
                {busy ? "Saving…" : "Save issue"}
              </button>
            </div>
          </form>
        )}

        {showLoading ? (
          <div className={paper} role="status">
            <div className={crest} />
            <div className="flex flex-col items-center gap-3 px-6 py-14">
              <Loader2 className="h-5 w-5 animate-spin text-dash-navy" />
              <p className="text-sm text-dash-surface-muted">Opening the school list…</p>
            </div>
          </div>
        ) : preview == null && board.isError ? (
          <Message
            title="This school link is not active."
            body={board.error instanceof Error ? board.error.message : "The list could not be loaded."}
            embedded
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
              if (!who || !current || !participantCanSet(current.status, status)) return;
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
              if (!window.confirm("Delete this issue? It leaves the shared list.")) return;
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
                setError(problem ?? "Enter your name so the issue shows who is working on it.");
                return;
              }
              void run(async () => {
                await uploadQuickIssueFile(normalized, id, file, role, who);
                remember(id);
              });
            }}
          />
        )}
      </div>
    </main>
  );
}

function Message({ title, body, embedded = false }: { title: string; body: string; embedded?: boolean }) {
  const Heading = embedded ? "h2" : "h1";
  const card = (
    <section className={`${paper} w-full max-w-md text-center`}>
      <div className={crest} />
      <div className="px-6 py-8">
        <p className={eyebrow}>MathGPL</p>
        <Heading className="mt-2 font-display text-2xl text-dash-navy">{title}</Heading>
        <p className="mt-2 text-sm text-dash-surface-muted">{body}</p>
      </div>
    </section>
  );
  if (embedded) return card;
  return <main className={`${desk} flex items-center justify-center px-4 py-16`}>{card}</main>;
}
