import SubjectMenu from "@/components/academia/mcq/SubjectMenu";
/** Home, History and My Evaluation screens of the downloaded Mathemagine app (Academia content). */
import { useMemo, useState } from "react";
import { Atom, BookOpen, CheckCircle2, FlaskConical, Pi, ChevronRight, PlayCircle, RotateCcw, Trash2, Undo2 } from "lucide-react";
import {
  attemptEarned, completedList, evaluationSeries, startedList, totals, activityEarned,
  type SessionAttempt, type Totals,
} from "@/lib/offline/evaluation";
import type { PackSchool } from "@/lib/offline/academiaStore";

const pctText = (t: Totals) => (t.percent == null ? "—" : `${t.percent}%`);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export function Ring({ percent, size = 140, label, sub, tone = "primary" }: { percent: number | null; size?: number; label: string; sub?: string; tone?: "primary" | "accent" }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`} className={tone === "primary" ? "stroke-primary" : "stroke-accent"} />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold leading-none">{label}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Bar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
      <span>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${className}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-2 flex items-center"><h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2><span className="ml-auto">{action}</span></div>;
}

/** Subject colour by name: Maths orange, Physics blue, Chemistry purple. */
export function subjectTone(name: string): { cls: string; Icon: typeof BookOpen } {
  const n = name.toLowerCase();
  if (/math|algebra|geometry|arith/.test(n)) return { cls: "mm-subject-maths", Icon: Pi };
  if (/phys/.test(n)) return { cls: "mm-subject-physics", Icon: Atom };
  if (/chem/.test(n)) return { cls: "mm-subject-chemistry", Icon: FlaskConical };
  return { cls: "mm-subject-other", Icon: BookOpen };
}

export function HomeScreen({ school, attempts, onContinue, onTab, onSubject, onOpenSession, recent }: {
  school: PackSchool | null; attempts: SessionAttempt[];
  onContinue: (a: SessionAttempt) => void; onTab: (t: "history" | "evaluation" | "schools" | "learn", sub?: "started" | "completed") => void;
  onSubject: (classIndex: number, subjectIndex: number) => void; onOpenSession: (sessionId: string) => void;
  recent: { sessionId: string; title: string; trail: string; status: string }[];
}) {
  const t = totals(attempts);
  const last = startedList(attempts)[0];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="mm-title text-2xl font-extrabold">Welcome back!</h1>
        <p className="text-sm text-muted-foreground">Keep learning, you're doing great.</p>
      </header>
      {school ? (
        <section className="mm-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current school</p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-lg font-bold">{school.name}</p>
            <button type="button" onClick={() => onTab("schools")} className="mm-accent-btn rounded-full px-4 py-1.5 text-sm font-bold">Switch</button>
          </div>
          <p className="truncate text-sm text-muted-foreground">{school.schoolName}</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-semibold">Choose your school to begin</p>
          <button type="button" onClick={() => onTab("schools")} className="mt-3 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Find a school</button>
        </section>
      )}

      <section>
        <SectionTitle>Continue learning</SectionTitle>
        {last ? (
          <div className="mm-hero p-4">
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">In progress</span>
            <p className="mt-2 text-lg font-bold">{last.sessionTitle}</p>
            <p className="text-sm opacity-80">{last.subjectName} · {last.topicName} · {last.subtopicName}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/30"><div className="mm-progress h-full rounded-full" style={{ width: `${last.maxMarks ? Math.min(100, (attemptEarned(last) / last.maxMarks) * 100) : 0}%` }} /></div>
            <div className="mt-3 flex items-center gap-3">
              <p className="flex-1 text-sm"><span className="text-xl font-bold">{attemptEarned(last)}</span> / {last.maxMarks} marks earned</p>
              <button type="button" onClick={() => onContinue(last)} className="mm-accent-btn inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 font-bold"><PlayCircle className="h-5 w-5" /> Continue</button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No session in progress. Open a session and write your first step to begin.</p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => onTab("history", "started")} className="mm-stat mm-stat-started p-4 text-left">
          <p className="text-sm text-muted-foreground">Started</p><p className="text-3xl font-bold">{t.started}</p><p className="text-xs text-primary">Continue sessions</p>
        </button>
        <button type="button" onClick={() => onTab("history", "completed")} className="mm-stat mm-stat-completed p-4 text-left">
          <p className="text-sm text-muted-foreground">Completed</p><p className="text-3xl font-bold">{t.completed}</p><p className="text-xs text-primary">View history</p>
        </button>
        <button type="button" onClick={() => onTab("evaluation")} className="mm-stat mm-stat-eval flex items-center gap-3 p-4 text-left">
          <Ring percent={t.percent} size={84} label={pctText(t)} />
          <div><p className="font-semibold">My Evaluation</p><p className="text-sm text-muted-foreground">{t.possible ? `${t.earned} / ${t.possible} marks` : "No graded sessions yet"}</p><p className="text-xs text-primary">Full report</p></div>
        </button>
      </section>

      {school && (
        <section>
          <SectionTitle>Explore subjects</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {school.classes.flatMap((c, ci) => c.subjects.map((s, si) => { const tone = subjectTone(s.name); return (
              <div key={`${c.id}-${s.id}`} className="relative">
                <button type="button" onClick={() => onSubject(ci, si)} className={`mm-subject ${tone.cls} w-full p-4 text-left`}>
                  <tone.Icon className="mb-2 h-8 w-8" />
                  <p className="font-bold">{s.name}</p><p className="text-xs opacity-85">{c.name} · {s.topics.length} topic{s.topics.length === 1 ? "" : "s"}</p>
                </button>
                <SubjectMenu subjectId={s.id} className="absolute right-2 top-2" />
              </div>
            ); }))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionTitle>Recent learning</SectionTitle>
          <div className="space-y-2">
            {recent.map((r) => (
              <button key={r.sessionId} type="button" onClick={() => onOpenSession(r.sessionId)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary">
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.title}</p><p className="truncate text-xs text-muted-foreground">{r.trail}</p></div>
                <span className="text-xs font-semibold text-muted-foreground">{r.status}</span><ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function HistoryScreen({ attempts, tab, setTab, onContinue, onRestart, onRemove, onRecover, onReview }: {
  attempts: SessionAttempt[]; tab: "started" | "completed"; setTab: (t: "started" | "completed") => void;
  onContinue: (a: SessionAttempt) => void; onRestart: (a: SessionAttempt) => void;
  onRemove: (a: SessionAttempt) => void; onRecover: (a: SessionAttempt) => void; onReview: (a: SessionAttempt) => void;
}) {
  const started = startedList(attempts), completed = completedList(attempts);
  const removed = attempts.filter((a) => a.status === "removed").sort((x, y) => (y.removedAt ?? "").localeCompare(x.removedAt ?? ""));
  const list = tab === "started" ? started : completed;
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">History</h1>
      <div role="tablist" className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        {(["started", "completed"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : ""}`}>
            {t} ({t === "started" ? started.length : completed.length})
          </button>
        ))}
      </div>
      {!list.length && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{tab === "started" ? "No sessions in progress." : "No completed sessions yet."}</p>}
      <div className="space-y-3">
        {list.map((a) => {
          const e = attemptEarned(a);
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                {a.status === "completed" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.sessionTitle} <span className="text-xs font-normal text-muted-foreground">· Attempt {a.attemptNo}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{a.subjectName} · {a.topicName} · {a.subtopicName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.status === "completed" ? `Completed ${when(a.completedAt)}` : `Started ${when(a.startedAt)} · Last activity ${when(a.lastAt)}`}
                  </p>
                </div>
                <div className="text-right"><p className="text-lg font-bold">{e}/{a.maxMarks}</p><p className="text-xs text-muted-foreground">{Math.round((e / a.maxMarks) * 100)}%</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "in_progress" ? (
                  <>
                    <button type="button" onClick={() => onContinue(a)} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Continue</button>
                    <button type="button" onClick={() => onRestart(a)} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-sm font-semibold"><RotateCcw className="h-4 w-4" /> Restart Session</button>
                    <button type="button" onClick={() => { if (window.confirm("Remove this unfinished attempt from your evaluation? You can recover it later.")) onRemove(a); }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-destructive"><Trash2 className="h-4 w-4" /> Remove</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onReview(a)} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Review</button>
                    <button type="button" onClick={() => onRestart(a)} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-sm font-semibold"><RotateCcw className="h-4 w-4" /> Restart Session</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {tab === "started" && removed.length > 0 && (
        <details className="mt-5 rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-semibold">Removed attempts ({removed.length})</summary>
          <ul className="mt-2 space-y-2">
            {removed.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{a.sessionTitle} · Attempt {a.attemptNo}</span>
                <button type="button" onClick={() => onRecover(a)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold"><Undo2 className="h-3 w-3" /> Recover</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ReviewScreen({ attempt, titles }: { attempt: SessionAttempt; titles: Record<string, string> }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{attempt.trail}</p>
      <h1 className="text-2xl font-bold">{attempt.sessionTitle} · Attempt {attempt.attemptNo}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{attempt.status === "completed" ? `Completed ${when(attempt.completedAt)}` : `Started ${when(attempt.startedAt)}`} · {attemptEarned(attempt)}/{attempt.maxMarks} marks</p>
      <div className="space-y-2">
        {Object.entries(attempt.activityMax).map(([id, max]) => (
          <div key={id} className="flex items-center rounded-xl border border-border bg-card p-3">
            <span className="min-w-0 flex-1 truncate">{titles[id] ?? "Activity"}</span>
            <span className="font-semibold">{activityEarned(attempt, id)} / {max}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Reviewing never changes the marks saved for this attempt.</p>
    </div>
  );
}

function LineChart({ points }: { points: { at: string; percent: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-muted-foreground">The chart appears after your second attempt.</p>;
  const W = 600, H = 160, step = W / (points.length - 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${i * step},${H - (p.percent / 100) * H}`).join(" ");
  return (
    <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="h-44 w-full" role="img" aria-label="Evaluation over time">
      {[0, 50, 100].map((g) => <line key={g} x1={0} x2={W} y1={H - (g / 100) * H} y2={H - (g / 100) * H} className="stroke-border" strokeDasharray="4 4" />)}
      <path d={d} fill="none" strokeWidth={3} className="stroke-primary" />
      {points.map((p, i) => <circle key={i} cx={i * step} cy={H - (p.percent / 100) * H} r={4} className="fill-primary"><title>{`${when(p.at)} — ${p.percent}%`}</title></circle>)}
    </svg>
  );
}

type Level = { key: "subjectId" | "topicId" | "subtopicId" | "sessionId"; name: (a: SessionAttempt) => string };
const LEVELS: Level[] = [
  { key: "subjectId", name: (a) => a.subjectName },
  { key: "topicId", name: (a) => a.topicName },
  { key: "subtopicId", name: (a) => a.subtopicName },
  { key: "sessionId", name: (a) => a.sessionTitle },
];

export function EvaluationScreen({ attempts }: { attempts: SessionAttempt[] }) {
  const t = totals(attempts);
  const series = useMemo(() => evaluationSeries(attempts), [attempts]);
  const [path, setPath] = useState<string[]>([]);
  const active = attempts.filter((a) => a.status !== "removed");
  if (!active.length) {
    return (
      <div>
        <h1 className="mb-3 text-2xl font-bold">My Evaluation</h1>
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">No graded sessions started yet.</p>
      </div>
    );
  }
  const depth = Math.min(path.length, LEVELS.length - 1);
  const scoped = active.filter((a) => path.every((id, i) => a[LEVELS[i].key] === id));
  const level = LEVELS[depth];
  const groups = [...new Map(scoped.map((a) => [a[level.key], level.name(a)])).entries()];
  const sessionAttempts = path.length === LEVELS.length ? scoped.sort((x, y) => x.attemptNo - y.attemptNo) : null;
  const facts = [
    `You have completed ${t.completed} session attempt${t.completed === 1 ? "" : "s"}.`,
    `You have earned ${t.earned} mark${t.earned === 1 ? "" : "s"}.`,
  ];
  const week = series.filter((p) => Date.now() - Date.parse(p.at) < 7 * 864e5);
  const before = series.filter((p) => Date.now() - Date.parse(p.at) >= 7 * 864e5).at(-1);
  if (before && week.length && week.at(-1)!.percent > before.percent) facts.push("You improved your cumulative evaluation this week.");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">My Evaluation</h1>
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row">
        <Ring percent={t.percent} size={180} label={pctText(t)} sub={`${t.earned} / ${t.possible} marks`} />
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {[["Marks earned", t.earned], ["Marks possible", t.possible], ["Completed", t.completed], ["Started", t.started], ["Active attempts", t.active]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-bold">{v}</p></div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Attempts (not marks)</SectionTitle>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <Ring percent={t.active ? (t.completed / t.active) * 100 : 0} size={120} label={`${t.completed}/${t.active}`} sub="completed" tone="accent" />
          <div className="w-full flex-1 space-y-2">
            <Bar label="Completed" value={t.completed} max={t.active} className="bg-primary" />
            <Bar label="In progress" value={t.started} max={t.active} className="bg-accent" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle action={path.length > 0 && <button type="button" onClick={() => setPath(path.slice(0, -1))} className="text-sm font-semibold text-primary">Back</button>}>
          {["By subject", "By topic", "By subtopic", "By session", "Attempts"][path.length]}
        </SectionTitle>
        {sessionAttempts ? (
          <div className="space-y-2">
            {sessionAttempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="w-24">Attempt {a.attemptNo}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(attemptEarned(a) / a.maxMarks) * 100}%` }} /></div>
                <span className="w-16 text-right font-semibold">{attemptEarned(a)}/{a.maxMarks}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(([id, name]) => {
              const g = totals(scoped, (a) => a[level.key] === id);
              return (
                <button key={id} type="button" onClick={() => setPath([...path, id])} className="grid w-full grid-cols-[minmax(0,1fr)_8rem_4rem] items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-muted">
                  <span className="truncate font-semibold">{name}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${g.percent ?? 0}%` }} /></div>
                  <span className="text-right font-semibold">{pctText(g)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Performance over time</SectionTitle>
        <LineChart points={series} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionTitle>Your progress</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">This is a cumulative, attempt-based evaluation: every Session attempt is worth 10 marks, and restarting a Session adds a new attempt. It measures you against your own learning, and is not an official school grade.</p>
      </section>
    </div>
  );
}
