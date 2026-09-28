/**
 * Academia Session: fixed video on the left, reorderable Activities on the
 * right, session tabs and breadcrumb. Activities reference existing items.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import {
  activityCatalogue,
  activityRoute,
  addActivity,
  deleteFrom,
  loadSessionContext,
  reorderActivities,
  updateSession,
  type ActivityKind,
} from "@/lib/academia/api";

const KIND_LABEL: Record<ActivityKind, string> = {
  game: "Game",
  lesson_note: "Lesson Note",
  smartboard: "Smartboard",
  adventure: "Adventure",
  question: "Question",
};

const embedUrl = (url: string): string => {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
};

const AcademiaSessionPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeOrgId } = useWorkspace();
  const [videoDraft, setVideoDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const key = ["academia-session", sessionId];
  const q = useQuery({ queryKey: key, enabled: !!sessionId, queryFn: () => loadSessionContext(sessionId!) });
  const catQ = useQuery({
    queryKey: ["academia-catalogue", activeOrgId],
    enabled: picking,
    queryFn: () => activityCatalogue(activeOrgId),
  });

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error((e as Error).message || "That didn't save.");
    }
  };

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening the session…
      </div>
    );
  }
  const ctx = q.data;
  if (!ctx) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        This session could not be found.
        <Link to="/academia" className="rounded-full border border-border px-4 py-2">Back to Academia</Link>
      </div>
    );
  }
  const { session, siblings, activities, canBuild } = ctx;
  const hasGame = activities.some((a) => a.kind === "game");
  const move = (i: number, d: number) => {
    const ids = activities.map((a) => a.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderActivities(ids));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/academia" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Academia
          </Link>
          {[ctx.klass?.name, ctx.subject?.name, ctx.topic?.name, ctx.subtopic?.name].filter(Boolean).map((n) => (
            <span key={n}>/ {n}</span>
          ))}
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto">
          {siblings.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/academia/session/${s.id}`)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
                s.id === session.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
              }`}
            >
              Session {i + 1}
            </button>
          ))}
        </nav>
      </header>

      <main className="grid gap-6 p-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <section className="lg:sticky lg:top-6 lg:self-start">
          <h1 className="mb-3 text-xl font-semibold">{session.title}</h1>
          <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-muted">
            {session.video_url ? (
              <iframe title={session.title} src={embedUrl(session.video_url)} className="h-full w-full" allowFullScreen />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No video yet.</div>
            )}
          </div>
          {canBuild && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => updateSession(session.id, { video_url: (videoDraft ?? "").trim() || null }));
                setVideoDraft(null);
              }}
            >
              <input
                value={videoDraft ?? session.video_url ?? ""}
                onChange={(e) => setVideoDraft(e.target.value)}
                placeholder="Paste a YouTube, Vimeo or video link"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Save video</button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Activities</span>
            {hasGame && (
              <div className="flex gap-2">
                {activities.filter((a) => a.kind === "game").slice(0, 1).map((g) => (
                  <Link key={g.id} to={activityRoute(g)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    <Play className="h-3.5 w-3.5" /> Practice / Play
                  </Link>
                ))}
              </div>
            )}
          </header>
          <ol className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {activities.length === 0 && <li className="py-8 text-center text-xs text-muted-foreground">No activities yet.</li>}
            {activities.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                <span className="w-6 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <Link to={activityRoute(a) || "#"} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {KIND_LABEL[a.kind]}{a.difficulty ? ` · ${a.difficulty}` : ""}
                  </span>
                </Link>
                {canBuild && (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label="Remove" onClick={() => run(() => deleteFrom("academia_activities", a.id))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {canBuild && (
            <div className="border-t border-border p-3">
              {!picking ? (
                <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                  <Plus className="h-4 w-4" /> Add activity
                </button>
              ) : (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const item = (catQ.data ?? []).find((c) => `${c.kind}:${c.id}` === pick);
                    if (!item) return;
                    run(() =>
                      addActivity({
                        session_id: session.id,
                        kind: item.kind,
                        ref_id: item.id,
                        title: item.title,
                        difficulty: difficulty || null,
                        position: activities.length,
                      }),
                    );
                    setPick("");
                    setPicking(false);
                  }}
                >
                  <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm">
                    <option value="">{catQ.isLoading ? "Loading…" : "Choose a game, lesson note, smartboard or adventure"}</option>
                    {(catQ.data ?? []).map((c) => (
                      <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                        {KIND_LABEL[c.kind]} — {c.title}
                      </option>
                    ))}
                  </select>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2 text-sm">
                    <option value="">Difficulty</option>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                  <button type="submit" className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Add</button>
                  <button type="button" onClick={() => setPicking(false)} className="rounded-lg border border-border px-3 text-sm">Cancel</button>
                </form>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AcademiaSessionPage;
