/**
 * Academia Session: compact video on the left (~25%), a horizontal Activity
 * carousel on the right (~75%), real session names as tabs, and a remembered
 * carousel position per person. Activities reference existing items.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImagePlus,
  Link2,
  Loader2,
  MonitorPlay,
  Pencil,
  Play,
  School,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import MediaImg from "@/components/academia/MediaImg";
import ThumbnailPicker from "@/components/academia/ThumbnailPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GuestLinkDialog from "@/components/guests/GuestLinkDialog";
import QuestionVideoEditor from "@/components/coursebuilder/QuestionVideoEditor";
import { listOwnedClasses } from "@/lib/courses/classCourses";
import {
  academiaIdOfClass,
  activityVideoLines,
  activityRoute,
  assignSessionToOwnClass,
  attachSessionLessonNote,
  copySessionLessonNoteToWorkspace,
  deleteFrom,
  listMyWorkspaceNotebooks,
  loadPosition,
  loadSessionContext,
  mediaUrl,
  myAttempts,
  startAttempt,
  syncAttempts,
  reorderActivities,
  saveActivityVideo,
  savePosition,
  uploadAcademiaMedia,
  updateActivity,
  updateSessionDetails,
  type AcademiaActivity,
  type ActivityKind,
} from "@/lib/academia/api";
import type { VideoLine } from "@/lib/courses/questionVideo";

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
  const { session, siblings, activities, canBuild } = ctx;
  const s = session as typeof session & { description?: string | null; thumbnail_path?: string | null };

  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [thumbFor, setThumbFor] = useState<null | "session" | AcademiaActivity>(null);
  const [assigning, setAssigning] = useState(false);
  const [notePicker, setNotePicker] = useState(false);
  const [guestLink, setGuestLink] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

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
  useEffect(() => { void listOwnedClasses().then(setClasses).catch(() => setClasses([])); }, []);
  const isTeacher = canBuild || classes.length > 0;

  return (
    <>
      {/* Trail */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/academia"))}
          className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground hover:border-primary/60 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Link to="/academia" className="hover:text-foreground">Academia</Link>
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
          {isTeacher && (
            <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Session teacher tools">
              <Button type="button" variant="outline" size="sm" className="h-auto min-h-16 flex-col gap-1" onClick={() => setAssigning(true)}>
                <School className="h-4 w-4" /> Assign
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-auto min-h-16 flex-col gap-1" onClick={() => session.lesson_note_id ? navigate(`/lesson-notes/${session.lesson_note_id}`) : setNotePicker(true)}>
                <BookOpen className="h-4 w-4" /> Note
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-auto min-h-16 flex-col gap-1" disabled={!session.lesson_note_id} onClick={() => session.lesson_note_id && navigate(`/smartboard/${session.lesson_note_id}/preview`)}>
                <MonitorPlay className="h-4 w-4" /> Smartboard
              </Button>
            </div>
          )}
          {canBuild && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setGuestLink(true)}>
              <Link2 className="mr-2 h-4 w-4" /> Session guest link
            </Button>
          )}
          {isTeacher && session.lesson_note_id && (
            <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" onClick={() => run(async () => {
              const copyId = await copySessionLessonNoteToWorkspace(session.lesson_note_id as string);
              toast.success("Lesson note copied to your workspace.");
              navigate(`/lesson-notes/${copyId}`);
            })}>
              <Copy className="mr-2 h-4 w-4" /> Copy note to my workspace
            </Button>
          )}
        </section>

        {/* Activities */}
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activities ({activities.length})</h2>
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
            academiaId={academiaId}
            onRefresh={() => qc.invalidateQueries({ queryKey })}
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

      {assigning && (
        <ClassPickerDialog classes={classes} onClose={() => setAssigning(false)} onPick={(classId) => run(async () => {
          const count = await assignSessionToOwnClass(session.id, classId);
          if (!count) throw new Error("This Session has no assignable questions yet.");
          toast.success(`${count} activit${count === 1 ? "y" : "ies"} assigned.`);
          setAssigning(false);
        })} />
      )}
      {notePicker && (
        <NotePickerDialog current={session.lesson_note_id ?? null} onClose={() => setNotePicker(false)} onPick={(notebookId) => run(async () => {
          await attachSessionLessonNote(session.id, notebookId);
          setNotePicker(false);
        })} />
      )}
      <GuestLinkDialog open={guestLink} onOpenChange={setGuestLink} kind="academia_session" resourceId={session.id} title={session.title} />

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
  academiaId,
  onRefresh,
}: {
  sessionId: string;
  activities: AcademiaActivity[];
  canBuild: boolean;
  onMove: (i: number, d: number) => void;
  onRemove: (id: string) => void;
  onThumb: (a: AcademiaActivity) => void;
  academiaId: string | null;
  onRefresh: () => Promise<unknown> | void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const [videoFor, setVideoFor] = useState<{ activity: AcademiaActivity; mode: "practice" | "play" } | null>(null);
  const [videoLines, setVideoLines] = useState<VideoLine[]>([]);
  const resolveAcademiaMedia = useCallback((path: string | null) => mediaUrl(path), []);
  const openVideo = async (activity: AcademiaActivity, mode: "practice" | "play") => {
    setVideoLines(await activityVideoLines(activity.subsection_id));
    setVideoFor({ activity, mode });
  };

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
  // This person's own record for the session; marks come back from Practice / Play.
  const attemptsQ = useQuery({
    queryKey: ["academia-attempts", sessionId],
    queryFn: async () => {
      await syncAttempts(sessionId, activities);
      return myAttempts([sessionId]);
    },
  });
  const statusLabel = (a: AcademiaActivity) => {
    if (!a.assessment_id && !a.link_code) return "";
    const rec = (attemptsQ.data ?? []).find((r) => r.mode === "practice") ?? (attemptsQ.data ?? []).find((r) => r.mode === "play");
    if (!rec) return "Not started";
    const best = rec.max_score > 0 ? ` · best ${rec.best_score}/${rec.max_score}` : "";
    return `${rec.status === "completed" ? "Completed" : "In progress"}${best}`;
  };
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
            {a.kind === "question" ? (
              <div className="relative">
                <QuestionCardFace
                  number={questionNumber(i)}
                  design={(a as AcademiaActivity & { question_design?: QuestionDesign | null }).question_design}
                  title={a.title}
                  imagePath={(a as AcademiaActivity & { thumbnail_path?: string | null }).thumbnail_path}
                />
                {a.difficulty && (
                  <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLE[a.difficulty] ?? "border-border bg-background/80"}`}>
                    {a.difficulty}
                  </span>
                )}
              </div>
            ) : (
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
            )}
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{a.kind === "question" ? `Question ${questionNumber(i)}` : KIND_LABEL[a.kind]}</p>
              <p className="line-clamp-2 text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{statusLabel(a)}</p>
              {a.assessment_id || a.link_code ? (
                <Link
                  to={`/academia/activity/${a.id}`}
                  onClick={() => remember(i)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Play className="h-4 w-4" /> Open
                </Link>
              ) : (
                <Link
                  to={activityRoute(a)}
                  onClick={() => remember(i)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Play className="h-4 w-4" /> {a.kind === "game" ? "Play" : "Open"}
                </Link>
              )}
              {canBuild && (
                <div className="grid grid-cols-2 gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void openVideo(a, "practice")} disabled={!a.subsection_id}>Add Practice video</Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void openVideo(a, "play")} disabled={!a.game_id || !a.subsection_id}>Add Play video</Button>
                </div>
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
      {videoFor && academiaId && (
        <QuestionVideoEditor
          open
          onOpenChange={(open) => !open && setVideoFor(null)}
          courseId={academiaId}
          blockId={videoFor.activity.id}
          questionId={videoFor.activity.id}
          questionLabel={`${videoFor.mode === "practice" ? "Practice" : "Play"} — ${videoFor.activity.title}`}
          lines={videoLines}
          config={(videoFor.mode === "practice" ? videoFor.activity.practice_video : videoFor.activity.play_video) ?? null}
          uploadMedia={(file) => uploadAcademiaMedia(academiaId, file, `${videoFor.mode}-video`)}
          resolveMedia={resolveAcademiaMedia}
          onPersistSave={(config) => saveActivityVideo(videoFor.activity.id, videoFor.mode, config)}
          onPersistRemove={() => saveActivityVideo(videoFor.activity.id, videoFor.mode, null)}
          onSaved={() => { void onRefresh(); }}
        />
      )}
    </div>
  );
};

const ClassPickerDialog = ({ classes, onClose, onPick }: { classes: { id: string; name: string }[]; onClose: () => void; onPick: (id: string) => void }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Assign Session activities</DialogTitle></DialogHeader>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {classes.length ? classes.map((row) => (
          <Button key={row.id} type="button" variant="outline" className="w-full justify-start" onClick={() => onPick(row.id)}>
            <School className="mr-2 h-4 w-4" /> {row.name}
          </Button>
        )) : <p className="py-8 text-center text-sm text-muted-foreground">Create a class in this workspace first.</p>}
      </div>
    </DialogContent>
  </Dialog>
);

const NotePickerDialog = ({ current, onClose, onPick }: { current: string | null; onClose: () => void; onPick: (id: string | null) => void }) => {
  const q = useQuery({ queryKey: ["my-workspace-notes"], queryFn: listMyWorkspaceNotebooks });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign lesson note and Smartboard</DialogTitle></DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {current && <Button type="button" variant="ghost" className="w-full justify-start text-destructive" onClick={() => onPick(null)}>Remove current note</Button>}
          {(q.data ?? []).map((row) => (
            <Button key={row.id} type="button" variant={row.id === current ? "secondary" : "outline"} className="w-full justify-start" onClick={() => onPick(row.id)}>
              <BookOpen className="mr-2 h-4 w-4" /> {row.title}
            </Button>
          ))}
          {!q.isLoading && !q.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">No lesson notes in this workspace.</p>}
        </div>
      </DialogContent>
    </Dialog>
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

export default AcademiaSessionPage;
