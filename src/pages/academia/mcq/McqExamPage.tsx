// One multiple-choice paper: exam → results → filtered review.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import McqText from "@/components/academia/mcq/McqText";
import { getPaper, saveAttempt } from "@/lib/academia/mcq/api";
import { markPaper, statusOf, type McqAnswers, type McqStatus } from "@/lib/academia/mcq/core";

type Mode = { k: "exam" } | { k: "results" } | { k: "review"; group: McqStatus };

export default function McqExamPage() {
  const { paperId } = useParams({ from: "/mcq/$paperId" });
  const router = useRouter();
  const paperQ = useQuery({ queryKey: ["mcq-paper", paperId], queryFn: () => getPaper(paperId) });
  const [answers, setAnswers] = useState<McqAnswers>({});
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>({ k: "exam" });
  const [submitting, setSubmitting] = useState(false);
  const qs = paperQ.data?.questions ?? [];
  const result = useMemo(() => markPaper(qs, answers), [qs, answers]);

  if (paperQ.isLoading) return <Shell><p className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening paper…</p></Shell>;
  if (!paperQ.data) return <Shell><p className="py-16 text-muted-foreground">This paper isn't available.</p></Shell>;
  const paper = paperQ.data;

  const submit = async () => {
    const left = qs.length - Object.keys(answers).length;
    if (left > 0 && !confirm(`You have ${left} unanswered question${left === 1 ? "" : "s"}. Submit anyway?`)) return;
    setSubmitting(true);
    try {
      await saveAttempt({ paper_id: paper.id, answers, correct: result.correct, incorrect: result.incorrect, unanswered: result.unanswered, total: result.total });
    } catch { toast.error("Your result is shown, but it couldn't be saved."); }
    setSubmitting(false);
    setMode({ k: "results" });
  };
  const retry = () => { setAnswers({}); setIdx(0); setMode({ k: "exam" }); };

  const header = (
    <div className="mb-5 flex items-center gap-3">
      <button type="button" onClick={() => (mode.k === "review" ? setMode({ k: "results" }) : router.history.back())} aria-label="Back"
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:border-primary"><ArrowLeft className="h-4 w-4" /></button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold sm:text-xl">{paper.title}</h1>
    </div>
  );

  if (mode.k === "results") {
    const tiles: { g: McqStatus; label: string; cls: string }[] = [
      { g: "correct", label: "Correct", cls: "border-success/40 bg-success/10 text-success" },
      { g: "incorrect", label: "Incorrect", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
      { g: "unanswered", label: "Unanswered", cls: "border-border bg-muted text-muted-foreground" },
    ];
    return (
      <Shell>{header}
        <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
          <Trophy className="mx-auto h-14 w-14 text-warning" />
          <h2 className="mt-3 text-2xl font-bold">Examination complete!</h2>
          <p className="mt-4 text-5xl font-extrabold tracking-tight">{result.correct}<span className="text-2xl text-muted-foreground"> / {result.total}</span></p>
          <div className="mx-auto mt-4 h-2.5 max-w-xs overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${result.percent}%` }} /></div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{result.percent}%</p>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {tiles.map((t) => (
              <button key={t.g} type="button" disabled={!result.groups[t.g].length}
                onClick={() => { setIdx(0); setMode({ k: "review", group: t.g }); }}
                className={`rounded-2xl border p-3 transition enabled:hover:-translate-y-0.5 disabled:opacity-60 ${t.cls}`}>
                <p className="text-2xl font-bold sm:text-3xl">{result.groups[t.g].length}</p>
                <p className="text-xs font-semibold sm:text-sm">{t.label}</p>
              </button>
            ))}
          </div>
          <Button onClick={retry} className="mt-6 gap-1.5"><RotateCcw className="h-4 w-4" /> Retry examination</Button>
        </section>
      </Shell>
    );
  }

  const reviewing = mode.k === "review";
  const list = reviewing ? result.groups[mode.group].map((n) => qs.find((q) => q.n === n)!) : qs;
  const q = list[Math.min(idx, list.length - 1)];
  const st = statusOf(q, answers);

  return (
    <Shell>{header}
      <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-primary">Question {q.n}{!reviewing && ` of ${qs.length}`}</span>
            {reviewing && <span className="text-muted-foreground">{idx + 1} of {list.length} {mode.group}</span>}
          </div>
          <div className="text-lg font-medium leading-relaxed"><McqText text={q.text} k={`q${q.n}`} /></div>
          <div className="mt-5 space-y-2.5">
            {q.options.map((o) => {
              const picked = answers[q.n] === o.label;
              const correct = reviewing && o.label === q.answer;
              const wrong = reviewing && picked && st === "incorrect";
              const cls = correct ? "border-primary bg-primary/10" : wrong ? "border-destructive bg-destructive/10"
                : picked ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-muted/50";
              return (
                <button key={o.label} type="button" disabled={reviewing}
                  onClick={() => setAnswers((a) => ({ ...a, [q.n]: o.label }))}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${cls}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${picked || correct ? (wrong ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground") : "bg-muted text-foreground"}`}>{o.label}</span>
                  <span className="min-w-0 flex-1"><McqText text={o.text} k={`o${q.n}${o.label}`} /></span>
                  {wrong && <span className="text-xs font-semibold text-destructive">Your answer</span>}
                  {correct && <span className="text-xs font-semibold text-primary">Correct answer</span>}
                </button>
              );
            })}
          </div>
          {reviewing && st === "unanswered" && <p className="mt-3 text-sm text-muted-foreground">You didn't answer this question.</p>}
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            {idx < list.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
            ) : reviewing ? (
              <Button onClick={() => setMode({ k: "results" })}>Back to results</Button>
            ) : (
              <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
            )}
          </div>
        </section>
        <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">{reviewing ? "Questions" : `${Object.keys(answers).length} of ${qs.length} answered`}</p>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {list.map((x, i) => {
              const s = statusOf(x, answers);
              const fill = reviewing ? (s === "correct" ? "bg-success text-success-foreground" : s === "incorrect" ? "bg-destructive text-destructive-foreground" : "bg-muted")
                : answers[x.n] ? "bg-primary text-primary-foreground" : "bg-muted";
              return (
                <button key={x.n} type="button" onClick={() => setIdx(i)}
                  className={`h-9 rounded-lg text-xs font-semibold ${fill} ${i === idx ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}>{x.n}</button>
              );
            })}
          </div>
          {!reviewing && <Button variant="outline" onClick={submit} disabled={submitting} className="mt-4 w-full">Submit paper</Button>}
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mm-app mm-light min-h-screen bg-background text-foreground"><div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">{children}</div></div>;
}
