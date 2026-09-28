import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, Library, Loader2 } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import {
  loadAcademiaTree,
  myAcademias,
  myAttempts,
  sessionStatus,
  sessionsOf,
  type SessionStatus,
} from "@/lib/academia/api";

const STATUS: Record<SessionStatus, { label: string; icon: typeof Circle; cls: string }> = {
  not_started: { label: "Not started", icon: Circle, cls: "text-muted-foreground" },
  in_progress: { label: "In progress", icon: Clock, cls: "text-primary" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-success" },
};

/**
 * Student Academia: discover each school's Academia (Class → Subject → Topic →
 * Subtopic), open a Session, and see the personal record and history.
 */
const StudentAcademiaView = () => {
  const acadQ = useQuery({ queryKey: ["student-academias"], queryFn: myAcademias });
  const [academiaId, setAcademiaId] = useState<string | null>(null);
  const current = (acadQ.data ?? []).find((a) => a.id === academiaId) ?? acadQ.data?.[0] ?? null;

  const treeQ = useQuery({
    queryKey: ["academia-tree", current?.id],
    enabled: !!current,
    queryFn: () => loadAcademiaTree(current!.id),
  });
  const subtopicIds = useMemo(() => (treeQ.data?.subtopics ?? []).map((s) => s.id), [treeQ.data]);
  const sessionsQ = useQuery({
    queryKey: ["student-academia-sessions", current?.id, subtopicIds.length],
    enabled: subtopicIds.length > 0,
    queryFn: () => sessionsOf(subtopicIds),
  });
  const attemptsQ = useQuery({ queryKey: ["academia-attempts", "all"], queryFn: () => myAttempts() });
  const [classId, setClassId] = useState<string | null>(null);

  if (acadQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening Academia…
      </div>
    );
  }
  if (!current) return <EmptyNote>No school Academia yet. Join a school to see its Academia.</EmptyNote>;

  const tree = treeQ.data;
  const attempts = attemptsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const cls = (tree?.classes ?? []).find((c) => c.id === classId) ?? tree?.classes[0] ?? null;
  const subjects = (tree?.subjects ?? []).filter((s) => s.class_id === cls?.id);
  const history = attempts
    .map((a) => ({ a, s: sessions.find((x) => x.id === a.session_id) }))
    .filter((x) => x.s)
    .slice(0, 8);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-4">
        <Library className="h-5 w-5 text-primary" />
        {(acadQ.data ?? []).length > 1 ? (
          <select
            value={current.id}
            onChange={(e) => setAcademiaId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold"
          >
            {(acadQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        ) : (
          <h2 className="text-base font-semibold">{current.name}</h2>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(tree?.classes ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              className={`rounded-full border px-3 py-1 text-xs ${cls?.id === c.id ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {treeQ.isLoading ? (
        <EmptyNote>Loading…</EmptyNote>
      ) : subjects.length === 0 ? (
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
                    return (
                      <div key={sub.id} className="mb-2">
                        <p className="mb-1 text-xs text-muted-foreground">{sub.name}</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {list.length === 0 && <span className="text-xs text-muted-foreground">No sessions yet.</span>}
                          {list.map((s, i) => {
                            const st = STATUS[sessionStatus(attempts, s.id)];
                            return (
                              <Link
                                key={s.id}
                                to={`/academia/session/${s.id}`}
                                className="w-56 shrink-0 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-primary/40"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Session {i + 1}</p>
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

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">My history</h3>
        {history.length === 0 ? (
          <EmptyNote>Nothing yet — open a Session and start Practice.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {history.map(({ a, s }) => (
              <li key={a.id}>
                <Link to={`/academia/session/${a.session_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 p-3 text-sm hover:border-primary/40">
                  <span className="min-w-0 truncate">{s!.title} · {a.mode === "play" ? "Play" : "Practice"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {a.max_score > 0 ? `Best ${a.best_score}/${a.max_score}` : a.status === "completed" ? "Completed" : "In progress"} · {a.attempts} attempt{a.attempts === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default StudentAcademiaView;
