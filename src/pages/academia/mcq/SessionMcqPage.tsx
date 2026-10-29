import { activityHref, activityNeighbours } from "@/lib/academia/activityChain";
import type { AcademiaActivity } from "@/lib/academia/api";
import { toast } from "sonner";
// Session Multiple-Choice activity: the one or two questions a teacher copied
// from a paper into this Session. Students answer, are marked automatically,
// see their score, and can go again. Teachers can preview the same way.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, PenLine, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import McqText from "@/components/academia/mcq/McqText";
import McqSolutionBoard from "@/components/academia/mcq/McqSolutionBoard";
import { getPaper, listSessionItems } from "@/lib/academia/mcq/api";
import { markPaper, statusOf, type McqAnswers, type McqQuestion } from "@/lib/academia/mcq/core";
import { loadActivity, recordActivityResult } from "@/lib/academia/api";

export default function SessionMcqPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const activityQ = useQuery({
    queryKey: ["mcq-activity", activityId],
    queryFn: () => loadActivity(activityId!),
    enabled: !!activityId,
  });
  const itemsQ = useQuery({
    queryKey: ["mcq-items", activityId],
    queryFn: () => listSessionItems(activityId!),
    enabled: !!activityId,
  });
  const paperQ = useQuery({
    queryKey: ["mcq-paper", activityQ.data?.ref_id],
    queryFn: () => getPaper(activityQ.data!.ref_id as string),
    enabled: !!activityQ.data?.ref_id,
  });
  const navigate = useNavigate();
  const neighbours = useQuery({ queryKey: ["mcq-practice-neighbours", activityId], enabled: !!activityId,
    queryFn: () => activityNeighbours(activityId!, "practice") });
  const [stepping, setStepping] = useState(false);
  const stepTo = async (activity: AcademiaActivity | null) => {
    if (!activity || stepping) return;
    setStepping(true);
    try {
      const href = await activityHref(activity, "practice");
      if (!href) throw new Error("This practice activity is not ready.");
      setAnswers({}); setIdx(0); setDone(false); setSolving(false);
      navigate(href);
    } catch (error) { toast.error((error as Error).message); }
    finally { setStepping(false); }
  };
  const [answers, setAnswers] = useState<McqAnswers>({});
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [solving, setSolving] = useState(false);

  const qs: McqQuestion[] = useMemo(
    () => (itemsQ.data ?? []).map((it) => ({
      n: it.n, text: it.text, options: it.options, answer: it.answer,
      solution: paperQ.data?.questions.find((p) => p.n === it.n)?.solution ?? null,
    })),
    [itemsQ.data, paperQ.data],
  );
  const result = useMemo(() => markPaper(qs, answers), [qs, answers]);

  if (activityQ.isLoading || itemsQ.isLoading) {
    return <Shell><p className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening questions…</p></Shell>;
  }
  const activity = activityQ.data;
  if (!activity || activity.kind !== "mcq" || qs.length === 0) {
    return <Shell><p className="py-16 text-muted-foreground">These questions aren't available.</p></Shell>;
  }

  const retry = () => { setAnswers({}); setIdx(0); setDone(false); };

  if (done) {
    return (
      <Shell>
        <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
          <Trophy className="mx-auto h-14 w-14 text-warning" />
          <h2 className="mt-3 text-2xl font-bold">Marked!</h2>
          <p className="mt-4 text-5xl font-extrabold tracking-tight">{result.correct}<span className="text-2xl text-muted-foreground"> / {result.total}</span></p>
          <div className="mx-auto mt-4 h-2.5 max-w-xs overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${result.percent}%` }} /></div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{result.percent}%</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={retry} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Go again</Button>
            <Button asChild variant="outline"><Link to={`/academia/session/${activity.session_id}`}>Back to Session</Link></Button>
          </div>
        </section>
        {/* Review every question with the correct answer highlighted. */}
        <section className="mt-6 space-y-4">
          {qs.map((q) => {
            const st = statusOf(q, answers);
            return (
              <div key={q.n} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-semibold">{q.n}. <McqText text={q.text} k={`r${q.n}`} /></p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const isAns = o.label === q.answer;
                    const picked = answers[q.n] === o.label;
                    return (
                      <span key={o.label} className={`rounded-lg border px-3 py-1.5 text-sm ${isAns ? "border-primary bg-primary/10 font-semibold" : picked ? "border-destructive bg-destructive/10" : "border-border"}`}>
                        {o.label}. <McqText text={o.text} k={`r${q.n}${o.label}`} />
                        {isAns && <span className="ml-2 text-xs text-primary">Correct</span>}
                        {picked && !isAns && <span className="ml-2 text-xs text-destructive">Your answer</span>}
                      </span>
                    );
                  })}
                </div>
                {st === "unanswered" && <p className="mt-1 text-xs text-muted-foreground">You didn't answer this one.</p>}
              </div>
            );
          })}
        </section>
      </Shell>
    );
  }

  const q = qs[Math.min(idx, qs.length - 1)]!;
  return (
    <Shell>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-primary">Question {idx + 1} of {qs.length}</span>
        </div>
        <div className="text-lg font-medium leading-relaxed"><McqText text={q.text} k={`q${q.n}`} /></div>
          {(q.solution) && (
            <div className="mt-4">
              <button type="button" onClick={() => setSolving((s) => !s)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary">
                <PenLine className="h-3.5 w-3.5" /> {solving ? "Hide solution" : "Solution"}
              </button>
              {solving && <div className="mt-3"><McqSolutionBoard solution={q.solution} keyId={`${q.n}`} /></div>}
            </div>
          )}
        <div className="mt-5 space-y-2.5">
          {q.options.map((o) => {
            const picked = answers[q.n] === o.label;
            return (
              <button key={o.label} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.n]: o.label }))}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${picked ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-muted/50"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${picked ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{o.label}</span>
                <span className="min-w-0 flex-1"><McqText text={o.text} k={`o${q.n}${o.label}`} /></span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="outline" disabled={idx === 0} onClick={() => (setSolving(false), setIdx((i) => i - 1))} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
          {idx < qs.length - 1 ? (
            <Button onClick={() => (setSolving(false), setIdx((i) => i + 1))} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={() => { setDone(true); void recordActivityResult(activity, result.correct, result.total).catch(() => undefined); }} disabled={Object.keys(answers).length === 0}>Finish &amp; mark</Button>
          )}
        </div>
      </section>
    </Shell>
  );

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="mm-app mm-light min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <Link to={activityQ.data ? `/academia/session/${activityQ.data.session_id}` : "/academia"} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Session
          </Link>
          <h1 className="mb-5 text-xl font-bold sm:text-2xl">{activityQ.data?.title ?? "Multiple Choice"}</h1>
          {neighbours.data && neighbours.data.total > 1 && <nav aria-label="Practice activities" className="mb-4 flex items-center justify-between gap-2">
            <Button variant="outline" disabled={!neighbours.data.prev || stepping} onClick={() => void stepTo(neighbours.data!.prev)}>Previous practice</Button>
            <span>{neighbours.data.index + 1}/{neighbours.data.total}</span>
            <Button variant="outline" disabled={!neighbours.data.next || stepping} onClick={() => void stepTo(neighbours.data!.next)}>Next practice</Button>
          </nav>}
          {children}
        </div>
      </div>
    );
  }
}
