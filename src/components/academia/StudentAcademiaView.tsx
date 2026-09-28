import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Clock, Compass, Eye, Library, Loader2, Play, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import MediaImg from "./MediaImg";
import {
  discoverAcademias,
  enrolAcademia,
  loadAcademiaTree,
  myAcademias,
  myAttempts,
  myEnrolmentIds,
  sessionStatus,
  sessionsOf,
  unenrolAcademia,
  type AcademiaPresentation,
  type AcademiaRow,
  type SessionStatus,
} from "@/lib/academia/api";

const STATUS: Record<SessionStatus, { label: string; icon: typeof Circle; cls: string }> = {
  not_started: { label: "Not started", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "In progress", icon: Clock, cls: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-success" },
};

type Acad = AcademiaRow & AcademiaPresentation & { school_name?: string };
type View = { kind: "home" } | { kind: "explore" } | { kind: "preview"; academia: Acad };

/**
 * Student Academia: Add / Explore public Academias, then learn inside them
 * (Class → Subject → Topic → Subtopic → Session) with a personal record.
 */
const StudentAcademiaView = () => {
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "home" });
  const acadQ = useQuery({ queryKey: ["student-academias"], queryFn: myAcademias });
  const enrolQ = useQuery({ queryKey: ["academia-enrolments"], queryFn: myEnrolmentIds });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["student-academias"] });
    qc.invalidateQueries({ queryKey: ["academia-enrolments"] });
  };
  const add = async (a: Acad) => {
    try {
      await enrolAcademia(a.id);
      refresh();
      toast.success(`${a.name} added to your workspace`);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't add that Academia.");
    }
  };
  const remove = async (a: Acad) => {
    await unenrolAcademia(a.id);
    refresh();
    toast.success(`${a.name} removed`);
  };
  const mine = acadQ.data ?? [];
  const isMine = (id: string) => mine.some((m) => m.id === id);

  if (acadQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening Academia…
      </div>
    );
  }
  if (view.kind === "explore") {
    return <Explore onBack={() => setView({ kind: "home" })} onView={(a) => setView({ kind: "preview", academia: a })} onAdd={add} isMine={isMine} />;
  }
  if (view.kind === "preview") {
    const a = view.academia;
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setView({ kind: "explore" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Explore
          </button>
          <div className="ml-auto">
            {isMine(a.id) ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 px-4 py-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> In your workspace</span>
            ) : (
              <button type="button" onClick={() => add(a)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Add to workspace
              </button>
            )}
          </div>
        </div>
        <Banner a={a} />
        <AcademiaBody academia={a} />
      </section>
    );
  }

  if (!mine.length) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
        <Library className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-xl font-semibold">No Academia yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Add an Academia to your workspace to start learning. Explore the public Academias from schools and teachers.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setView({ kind: "explore" })} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Add Academia
          </button>
          <button type="button" onClick={() => setView({ kind: "explore" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:border-primary/50">
            <Compass className="h-4 w-4" /> Explore Academias
          </button>
        </div>
      </section>
    );
  }

  return <Home mine={mine} enrolled={enrolQ.data ?? []} onExplore={() => setView({ kind: "explore" })} onRemove={remove} />;
};

const Banner = ({ a }: { a: Acad }) => (
  <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
    <div className="relative h-32 bg-gradient-to-br from-primary/25 via-card to-background">
      <MediaImg path={a.cover_path} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
    </div>
    <div className="relative -mt-10 flex items-end gap-4 px-5 pb-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/60 bg-background">
        <MediaImg path={a.presentation_path} className="h-full w-full object-cover" fallback={<Library className="m-6 h-8 w-8 text-primary" />} />
      </div>
      <div className="min-w-0">
        {a.school_name && <p className="text-xs uppercase tracking-[0.2em] text-primary">{a.school_name}</p>}
        <h2 className="truncate text-xl font-semibold">{a.name}</h2>
        {a.description && <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
      </div>
    </div>
  </div>
);

const Explore = ({ onBack, onView, onAdd, isMine }: { onBack: () => void; onView: (a: Acad) => void; onAdd: (a: Acad) => void; isMine: (id: string) => boolean }) => {
  const [q, setQ] = useState("");
  const listQ = useQuery({ queryKey: ["academia-discover", q], queryFn: () => discoverAcademias(q) });
  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Academia
      </button>
      <div>
        <h2 className="text-xl font-semibold">Explore Academias</h2>
        <p className="text-sm text-muted-foreground">Find a public Academia and add it to your workspace.</p>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by Academia or school name" className="w-full bg-transparent text-sm outline-none" />
      </label>
      {listQ.isLoading ? (
        <EmptyNote>Searching…</EmptyNote>
      ) : (listQ.data ?? []).length === 0 ? (
        <EmptyNote>No Academias match that search.</EmptyNote>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(listQ.data ?? []).map((a) => (
            <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative h-28 bg-gradient-to-br from-primary/25 via-card to-background">
                <MediaImg path={a.cover_path} className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary">{a.school_name}</p>
                <h3 className="font-semibold">{a.name}</h3>
                <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{a.description || "A MathGPL learning Academia."}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => onView(a)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/50">
                    <Eye className="h-4 w-4" /> View
                  </button>
                  {isMine(a.id) ? (
                    <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Added</span>
                  ) : (
                    <button type="button" onClick={() => onAdd(a)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const Home = ({ mine, enrolled, onExplore, onRemove }: { mine: Acad[]; enrolled: string[]; onExplore: () => void; onRemove: (a: Acad) => void }) => {
  const [academiaId, setAcademiaId] = useState<string | null>(null);
  const current = mine.find((a) => a.id === academiaId) ?? mine[0];
  const attemptsQ = useQuery({ queryKey: ["academia-attempts", "all"], queryFn: () => myAttempts() });
  const attempts = attemptsQ.data ?? [];
  const lastIds = useMemo(() => Array.from(new Set(attempts.map((a) => a.session_id))), [attempts]);
  const allSessQ = useQuery({
    queryKey: ["academia-history-sessions", lastIds.join(",")],
    enabled: lastIds.length > 0,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("academia_sessions").select("id, title").in("id", lastIds);
      return (data ?? []) as { id: string; title: string }[];
    },
  });
  const titleOf = (id: string) => allSessQ.data?.find((s) => s.id === id)?.title ?? "Session";
  const last = attempts[0];

  return (
    <section className="space-y-5">
      <div className="flex snap-x gap-4 overflow-x-auto pb-2">
        <button type="button" onClick={onExplore} className="flex w-64 shrink-0 snap-start flex-col justify-between rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-card p-5 text-left">
          <Compass className="h-7 w-7 text-primary" />
          <div>
            <p className="text-lg font-semibold">Explore</p>
            <p className="text-xs text-muted-foreground">Find and add more Academias</p>
          </div>
        </button>
        <div className="flex w-64 shrink-0 snap-start flex-col justify-between rounded-2xl border border-border bg-card p-5">
          <Play className="h-7 w-7 text-primary" />
          {last ? (
            <Link to={`/academia/session/${last.session_id}`} className="block">
              <p className="text-xs text-muted-foreground">Continue Learning</p>
              <p className="line-clamp-2 text-lg font-semibold">{titleOf(last.session_id)}</p>
              <p className="text-xs text-primary">{last.status === "completed" ? "Completed" : "In progress"} · Continue →</p>
            </Link>
          ) : (
            <div>
              <p className="text-lg font-semibold">Continue Learning</p>
              <p className="text-xs text-muted-foreground">Open a Session to start.</p>
            </div>
          )}
        </div>
        {mine.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAcademiaId(a.id)}
            className={`relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl border text-left ${current.id === a.id ? "border-primary" : "border-border"} bg-card`}
          >
            <div className="relative h-20 bg-gradient-to-br from-primary/25 via-card to-background">
              <MediaImg path={a.cover_path} className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <div className="p-3">
              <p className="truncate font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{current.id === a.id ? "Open now" : "Open"}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end">
        {enrolled.includes(current.id) && (
          <button type="button" onClick={() => onRemove(current)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Remove from workspace
          </button>
        )}
      </div>
      <Banner a={current} />
      <AcademiaBody academia={current} />

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Previous Activities</h3>
        {attempts.length === 0 ? (
          <EmptyNote>Nothing yet — open a Session and start Practice.</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3">Session</th><th className="pr-3">Mode</th><th className="pr-3">Best score</th><th className="pr-3">Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {attempts.slice(0, 20).map((a) => (
                  <tr key={a.id} className="border-t border-border/50">
                    <td className="py-2 pr-3"><Link to={`/academia/session/${a.session_id}`} className="hover:text-primary">{titleOf(a.session_id)}</Link></td>
                    <td className="pr-3">{a.mode === "play" ? "Play" : "Practice"}</td>
                    <td className="pr-3">{a.max_score > 0 ? `${a.best_score}/${a.max_score}` : "—"}</td>
                    <td className="pr-3">{a.status === "completed" ? "Completed" : "In progress"}</td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <td className="text-xs text-muted-foreground">{new Date(((a as any).updated_at ?? (a as any).created_at) as string).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

/** Class → Subject → Topic → Subtopic → Sessions, with search and status. */
const AcademiaBody = ({ academia }: { academia: Acad }) => {
  const treeQ = useQuery({ queryKey: ["academia-tree", academia.id], queryFn: () => loadAcademiaTree(academia.id) });
  const subtopicIds = useMemo(() => (treeQ.data?.subtopics ?? []).map((s) => s.id), [treeQ.data]);
  const sessionsQ = useQuery({
    queryKey: ["student-academia-sessions", academia.id, subtopicIds.length],
    enabled: subtopicIds.length > 0,
    queryFn: () => sessionsOf(subtopicIds),
  });
  const attemptsQ = useQuery({ queryKey: ["academia-attempts", "all"], queryFn: () => myAttempts() });
  const [classId, setClassId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const tree = treeQ.data;
  const attempts = attemptsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const cls = (tree?.classes ?? []).find((c) => c.id === classId) ?? tree?.classes[0] ?? null;
  const subjects = (tree?.subjects ?? []).filter((s) => s.class_id === cls?.id);
  const needle = q.trim().toLowerCase();
  const hit = (t: string) => !needle || t.toLowerCase().includes(needle);

  if (treeQ.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-3">
        {(tree?.classes ?? []).map((c) => (
          <button key={c.id} type="button" onClick={() => setClassId(c.id)} className={`rounded-full border px-3 py-1 text-xs ${cls?.id === c.id ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            {c.name}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-input bg-background px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics or sessions" className="w-44 bg-transparent text-xs outline-none" />
        </label>
      </div>
      {subjects.length === 0 ? (
        <EmptyNote>No subjects in this class yet.</EmptyNote>
      ) : (
        subjects.map((subject) => {
          const topics = (tree?.topics ?? []).filter((t) => t.subject_id === subject.id);
          return (
            <div key={subject.id} className="rounded-2xl border border-border/60 bg-card/60 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{subject.name}</h3>
              {topics.length === 0 && <EmptyNote>No topics yet.</EmptyNote>}
              {topics.map((topic) => (
                <div key={topic.id} className="mb-3">
                  <p className="mb-2 text-sm font-semibold">{topic.name}</p>
                  {(tree?.subtopics ?? []).filter((s) => s.topic_id === topic.id).map((sub) => {
                    const list = sessions.filter((s) => s.subtopic_id === sub.id);
                    const shown = list.filter((s) => hit(s.title) || hit(sub.name) || hit(topic.name));
                    if (needle && !shown.length) return null;
                    return (
                      <div key={sub.id} className="mb-2">
                        <p className="mb-1 text-xs text-muted-foreground">{sub.name}</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {list.length === 0 && <span className="text-xs text-muted-foreground">No sessions yet.</span>}
                          {shown.map((s) => {
                            const st = STATUS[sessionStatus(attempts, s.id)];
                            return (
                              <Link key={s.id} to={`/academia/session/${s.id}`} className="w-56 shrink-0 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-primary/40">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Session {list.indexOf(s) + 1}</p>
                                <p className="line-clamp-2 text-sm font-medium">{s.title}</p>
                                <p className={`mt-2 inline-flex items-center gap-1 text-xs ${st.cls}`}>
                                  <st.icon className="h-3.5 w-3.5" /> {st.label}
                                </p>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default StudentAcademiaView;
