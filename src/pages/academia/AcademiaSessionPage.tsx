/**
 * Academia Session: compact video on the left (~25%), a horizontal Activity
 * carousel on the right (~75%), real session names as tabs, and a remembered
 * carousel position per person. Activities reference existing items.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import MediaImg from "@/components/academia/MediaImg";
import ThumbnailPicker from "@/components/academia/ThumbnailPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import {
  academiaIdOfClass,
  activityCatalogue,
  activityRoute,
  addActivity,
  deleteFrom,
  loadPosition,
  loadSessionContext,
  reorderActivities,
  savePosition,
  updateActivity,
  updateSessionDetails,
  type AcademiaActivity,
  type ActivityKind,
} from "@/lib/academia/api";

const KIND_LABEL: Record<ActivityKind, string> = {
  game: "Game",
  lesson_note: "Lesson Note",
  smartboard: "Smartboard",
  adventure: "Adventure",
  question: "Question",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: "border-success/50 bg-success/15 text-success",
  Medium: "border-primary/50 bg-primary/15 text-primary",
  Difficult: "border-destructive/50 bg-destructive/15 text-destructive",
};

const embedUrl = (url: string): string => {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
};
const youtubePoster = (url: string | null) => {
  const yt = url?.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
};
const isDirectVideo = (url: string | null) => !!url && !/youtu|vimeo/.test(url);

type Ctx = NonNullable<Awaited<ReturnType<typeof loadSessionContext>>>;

const AcademiaSessionPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const key = ["academia-session", sessionId];
  const q = useQuery({ queryKey: key, enabled: !!sessionId, queryFn: () => loadSessionContext(sessionId!) });
  const acadQ = useQuery({
    queryKey: ["academia-of-class", q.data?.klass?.id],
    enabled: !!q.data?.klass?.id,
    queryFn: () => academiaIdOfClass(q.data!.klass!.id),
  });

  return (
    <WorkspaceLayout title={q.data?.session.title ?? "Academia"} collapsibleNav>
      <div className="mx-auto w-full max-w-[1500px] px-2 py-4">
        {q.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening the session…
          </div>
        ) : !q.data ? (
          <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
            This session could not be found.
            <Link to="/academia" className="rounded-full border border-border px-4 py-2">Back to Academia</Link>
          </div>
        ) : (
          <SessionBody key={q.data.session.id} ctx={q.data} academiaId={acadQ.data ?? null} queryKey={key} />
        )}
      </div>
    </WorkspaceLayout>
  );
};

const SessionBody = ({ ctx, academiaId, queryKey }: { ctx: Ctx; academiaId: string | null; queryKey: unknown[] }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeOrgId } = useWorkspace();
  const { session, siblings, activities, canBuild } = ctx;
  const s = session as typeof session & { description?: string | null; thumbnail_path?: string | null };

  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [thumbFor, setThumbFor] = useState<null | "session" | AcademiaActivity>(null);
  const [picking, setPicking] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error((e as Error).message || "That didn't save.");
    }
  };

  const poster = youtubePoster(session.video_url);
  const context = { topic: ctx.topic?.name, subtopic: ctx.subtopic?.name, session: session.title };

  return (
    <>
      {/* Trail */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground">
        <Link to="/academia" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Academia
        </Link>
        {[ctx.klass?.name, ctx.subject?.name, ctx.topic?.name, ctx.subtopic?.name].filter(Boolean).map((n, i, arr) => (
          <span key={`${n}-${i}`} className={i === arr.length - 1 ? "text-primary" : ""}>
            <ChevronRight className="mr-1 inline h-3.5 w-3.5" />
            {n}
          </span>
        ))}
      </nav>

      {/* Header */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{ctx.subtopic?.name ?? ctx.topic?.name}</p>
          <h1 className="truncate text-3xl font-semibold">{session.title}</h1>
          {s.description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{s.description}</p>}
        </div>
        <div className="text-sm text-muted-foreground">{activities.length} activit{activities.length === 1 ? "y" : "ies"}</div>
      </header>

      {/* Session tabs — real names, never "Session 1" */}
      <SessionTabs siblings={siblings} current={session.id} onPick={(id) => navigate(`/academia/session/${id}`)} />

      <main className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3fr)]">
        {/* Compact video */}
        <section className="self-start rounded-2xl border border-border bg-card p-3">
          <h2 className="mb-2 flex items-center gap-2 truncate text-sm font-semibold">
            <Video className="h-4 w-4 text-primary" /> {session.title}
          </h2>
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
            {playing && session.video_url ? (
              isDirectVideo(session.video_url) ? (
                <video src={session.video_url} controls autoPlay className="h-full w-full" />
              ) : (
                <iframe title={session.title} src={embedUrl(session.video_url)} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
              )
            ) : session.video_url ? (
              <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label="Play video">
                <MediaImg
                  path={s.thumbnail_path}
                  className="h-full w-full object-cover"
                  fallback={
                    poster ? (
                      <img src={poster} alt="" className="h-full w-full object-cover" />
                    ) : isDirectVideo(session.video_url) ? (
                      <video src={`${session.video_url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
                    ) : null
                  }
                />
                <span className="absolute inset-0 flex items-center justify-center bg-background/20 transition group-hover:bg-background/10">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground/80 bg-background/50 backdrop-blur">
                    <Play className="ml-1 h-6 w-6" />
                  </span>
                </span>
              </button>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No video yet.</div>
            )}
          </div>
          {s.description && (
            <div className="mt-3 rounded-xl bg-muted/40 p-3">
              <p className="text-xs font-semibold">Video description</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            </div>
          )}
          {canBuild && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                <Pencil className="h-3.5 w-3.5" /> Video & details
              </button>
              <button
                type="button"
                disabled={!academiaId}
                onClick={() => setThumbFor("session")}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
              >
                <ImagePlus className="h-3.5 w-3.5" /> Thumbnail
              </button>
            </div>
          )}
        </section>

        {/* Activities */}
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activities ({activities.length})</h2>
            {canBuild && (
              <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                <Plus className="h-4 w-4" /> Add activity
              </button>
            )}
          </header>
          <ActivityCarousel
            sessionId={session.id}
            activities={activities}
            canBuild={canBuild}
            onMove={(i, d) => {
              const ids = activities.map((a) => a.id);
              const j = i + d;
              if (j < 0 || j >= ids.length) return;
              [ids[i], ids[j]] = [ids[j], ids[i]];
              run(() => reorderActivities(ids));
            }}
            onRemove={(id) => run(() => deleteFrom("academia_activities", id))}
            onThumb={(a) => academiaId && setThumbFor(a)}
          />
        </section>
      </main>

      {editing && (
        <DetailsDialog
          initial={{ title: session.title, description: s.description ?? "", video: session.video_url ?? "" }}
          onClose={() => setEditing(false)}
          onSave={(v) =>
            run(async () => {
              await updateSessionDetails(session.id, {
                title: v.title.trim() || session.title,
                description: v.description.trim() || null,
                video_url: v.video.trim() || null,
              });
              setEditing(false);
              setPlaying(false);
            })
          }
        />
      )}

      {thumbFor && academiaId && (
        <ThumbnailPicker
          open
          onOpenChange={(v) => !v && setThumbFor(null)}
          academiaId={academiaId}
          label={thumbFor === "session" ? "session" : "activity"}
          title={thumbFor === "session" ? "Video thumbnail" : "Activity picture"}
          videoUrl={thumbFor === "session" ? session.video_url : null}
          context={thumbFor === "session" ? context : { ...context, task: `${KIND_LABEL[thumbFor.kind]}: ${thumbFor.title}` }}
          onPicked={(path) =>
            run(() =>
              thumbFor === "session"
                ? updateSessionDetails(session.id, { thumbnail_path: path })
                : updateActivity(thumbFor.id, { thumbnail_path: path }),
            )
          }
        />
      )}

      {picking && (
        <AddActivityDialog
          orgId={activeOrgId}
          onClose={() => setPicking(false)}
          onAdd={(item, difficulty) =>
            run(async () => {
              await addActivity({
                session_id: session.id,
                kind: item.kind,
                ref_id: item.id,
                title: item.title,
                difficulty: difficulty || null,
                position: activities.length,
              });
              setPicking(false);
            })
          }
        />
      )}
    </>
  );
};

const SessionTabs = ({ siblings, current, onPick }: { siblings: { id: string; title: string }[]; current: string; onPick: (id: string) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-current='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 260, behavior: "smooth" });
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => scroll(-1)} aria-label="Previous sessions" className="shrink-0 rounded-full border border-border p-1.5 hover:bg-muted">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={ref} className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
        {siblings.map((sib) => (
          <button
            key={sib.id}
            type="button"
            data-current={sib.id === current}
            onClick={() => onPick(sib.id)}
            className={`min-w-[170px] max-w-[240px] shrink-0 truncate rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
              sib.id === current ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            {sib.title}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => scroll(1)} aria-label="Next sessions" className="shrink-0 rounded-full border border-border p-1.5 hover:bg-muted">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

const CARD_W = 208;

const ActivityCarousel = ({
  sessionId,
  activities,
  canBuild,
  onMove,
  onRemove,
  onThumb,
}: {
  sessionId: string;
  activities: AcademiaActivity[];
  canBuild: boolean;
  onMove: (i: number, d: number) => void;
  onRemove: (id: string) => void;
  onThumb: (a: AcademiaActivity) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Return each person to where they last were in this session.
  useEffect(() => {
    if (restored.current || !activities.length) return;
    restored.current = true;
    void loadPosition(sessionId).then((i) => {
      const el = ref.current;
      if (el && i > 0) el.scrollLeft = Math.min(i, activities.length - 1) * (CARD_W + 12);
    });
  }, [sessionId, activities.length]);

  const onScroll = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (el) void savePosition(sessionId, Math.round(el.scrollLeft / (CARD_W + 12)));
    }, 600);
  };
  const remember = (i: number) => void savePosition(sessionId, i);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * (CARD_W + 12) * 2, behavior: "smooth" });

  if (!activities.length) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">No activities yet.</p>;
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => scroll(-1)} aria-label="Previous activities" className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 shadow hover:border-primary/50">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div ref={ref} onScroll={onScroll} className="flex snap-x gap-3 overflow-x-auto scroll-smooth px-6 pb-3">
        {activities.map((a, i) => (
          <article
            key={a.id}
            style={{ width: CARD_W }}
            className="group flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/40 to-card transition hover:-translate-y-0.5 hover:border-primary/50"
          >
            <div className="relative aspect-[4/3] bg-muted">
              <MediaImg
                path={(a as AcademiaActivity & { thumbnail_path?: string | null }).thumbnail_path}
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-background text-3xl font-semibold text-primary/70">
                    {KIND_LABEL[a.kind][0]}
                  </div>
                }
              />
              <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/85 text-xs font-semibold">
                {i + 1}
              </span>
              {a.difficulty && (
                <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLE[a.difficulty] ?? "border-border bg-background/80"}`}>
                  {a.difficulty}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{KIND_LABEL[a.kind]}</p>
              <p className="line-clamp-2 text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">Not started</p>
              <Link
                to={activityRoute(a)}
                onClick={() => remember(i)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Play className="h-4 w-4" /> {a.kind === "game" ? "Play" : "Open"}
              </Link>
              {a.kind === "game" && (
                <span className="text-center text-[11px] text-muted-foreground">Practice is inside the game</span>
              )}
              {canBuild && (
                <div className="flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
                  <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="Move left" className="rounded p-1 hover:bg-muted disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onThumb(a)} aria-label="Change picture" className="rounded p-1 hover:bg-muted">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => confirm(`Remove "${a.title}"?`) && onRemove(a.id)} aria-label="Remove" className="rounded p-1 hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === activities.length - 1} aria-label="Move right" className="rounded p-1 hover:bg-muted disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <button type="button" onClick={() => scroll(1)} aria-label="Next activities" className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 shadow hover:border-primary/50">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};

const DetailsDialog = ({
  initial,
  onClose,
  onSave,
}: {
  initial: { title: string; description: string; video: string };
  onClose: () => void;
  onSave: (v: { title: string; description: string; video: string }) => void;
}) => {
  const [v, setV] = useState(initial);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session details</DialogTitle>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          Session name
          <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Video link (YouTube, Vimeo or a video file)
          <input value={v.video} onChange={(e) => setV({ ...v, video: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Description
          <textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <button type="button" onClick={() => onSave(v)} className="justify-self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Save
        </button>
      </DialogContent>
    </Dialog>
  );
};

const AddActivityDialog = ({
  orgId,
  onClose,
  onAdd,
}: {
  orgId: string | null;
  onClose: () => void;
  onAdd: (item: { kind: ActivityKind; id: string; title: string }, difficulty: string) => void;
}) => {
  const [pick, setPick] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const catQ = useQuery({ queryKey: ["academia-catalogue", orgId], queryFn: () => activityCatalogue(orgId) });
  const items = catQ.data ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an activity</DialogTitle>
        </DialogHeader>
        {catQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Choose a game, lesson note, Smartboard or adventure…</option>
            {items.map((it) => (
              <option key={`${it.kind}:${it.id}`} value={`${it.kind}:${it.id}`}>
                {KIND_LABEL[it.kind]} — {it.title}
              </option>
            ))}
          </select>
        )}
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="">No difficulty</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Difficult</option>
        </select>
        <button
          type="button"
          disabled={!pick}
          onClick={() => {
            const item = items.find((it) => `${it.kind}:${it.id}` === pick);
            if (item) onAdd(item, difficulty);
          }}
          className="justify-self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default AcademiaSessionPage;
