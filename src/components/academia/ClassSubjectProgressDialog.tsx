/**
 * How far have you gone — for ONE class + subject pair (e.g. Year One ·
 * Mathematics). Never combined with another pair. Primary score is
 * attempted-over-attempted; the class–subject total is shown as context, and
 * the Beginner → Intermediate → Expert ladder shows the journey. Teachers also
 * see every learner, can cancel a learner's attempt, and read the cancel log.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cancelSessionAttempt,
  classSubjectLearnerReports,
  classSubjectScope,
  myAttempts,
  reportFor,
  sessionCancels,
} from "@/lib/academia/api";
import { NOT_STARTED_LABEL, TIER_LABEL, TIERS, isTier, percent, reportView, type ClassSubjectReport } from "@/lib/academia/tiers";
import { PERFORMANCE_LABEL, performanceExplanation, type PerformanceView } from "@/lib/academia/evaluationScore";
import PerformanceTabs from "@/components/academia/PerformanceTabs";

export const ProgressSummary = ({ report, label, view }: { report: ClassSubjectReport; label: string; view: PerformanceView }) => {
  const headline = reportView(report, view);
  const name = PERFORMANCE_LABEL[view];
  return (
  <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-border p-3" data-testid="progress-score" data-percent={headline.started ? percent(headline.score, headline.max) : ""}>
        <p className="text-xs text-muted-foreground">{name} · on attempted work</p>
        {headline.started ? (
          <p className="text-2xl font-semibold">
            {headline.score}<span className="text-base text-muted-foreground"> / {headline.max}</span>
            <span className="ml-2 text-sm text-primary">{percent(headline.score, headline.max)}%</span>
          </p>
        ) : (
          <p className="text-2xl font-semibold text-muted-foreground">{NOT_STARTED_LABEL}</p>
        )}
      </div>
      <div className="rounded-xl border border-border p-3">
        <p className="text-xs text-muted-foreground">Of everything in {label}{view === "overall" ? "" : ` · ${name}`}</p>
        <p className="text-2xl font-semibold">
          {headline.score}<span className="text-base text-muted-foreground"> of {headline.total}</span>
        </p>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">{performanceExplanation(view)}</p>
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Tier ladder">
      {report.ladder.map((step, i) => (
        <li key={step.tier} className={`rounded-xl border bg-muted/30 p-3 text-xs ${view !== "overall" && step.tier === view ? "border-primary" : "border-border"}`}>
          <p className="font-semibold">{i + 1}. {TIER_LABEL[step.tier]}</p>
          {step.sessionsAttempted === 0 ? (
            <p className="mt-1 text-muted-foreground">{NOT_STARTED_LABEL}</p>
          ) : (
            <>
              <p className="mt-1">{step.attemptedScore} / {step.attemptedMax} on attempted ({percent(step.attemptedScore, step.attemptedMax)}%)</p>
              <p className="text-muted-foreground">{step.attemptedScore} of {step.totalMax} available</p>
            </>
          )}
          <p className="mt-1 text-muted-foreground">{step.sessionsCompleted} done · {step.sessionsAttempted} started · {step.sessionsTotal} sessions</p>
        </li>
      ))}
    </ol>
  </div>
  );
};

const ClassSubjectProgressDialog = ({
  subjectId,
  currentSessionId,
  onClose,
  onChanged,
}: {
  subjectId: string;
  currentSessionId?: string;
  onClose: () => void;
  onChanged?: () => void;
}) => {
  const scopeQ = useQuery({ queryKey: ["academia-class-subject", subjectId], queryFn: () => classSubjectScope(subjectId) });
  const scope = scopeQ.data ?? null;
  const sessionIds = scope?.sessions.map((s) => s.id) ?? [];
  const mineQ = useQuery({
    queryKey: ["academia-attempts", "subject", subjectId],
    enabled: !!scope,
    queryFn: () => myAttempts(sessionIds),
  });
  const learnersQ = useQuery({
    queryKey: ["academia-class-subject-learners", subjectId],
    enabled: !!scope?.canBuild,
    queryFn: () => classSubjectLearnerReports(scope!),
  });
  const cancelsQ = useQuery({
    queryKey: ["academia-cancels", subjectId],
    enabled: !!scope?.canBuild,
    queryFn: () => sessionCancels(sessionIds),
  });
  const [view, setView] = useState<PerformanceView>("overall");
  const titleOf = new Map(scope?.sessions.map((s) => [s.id, s.title]) ?? []);
  const nameOf = new Map((learnersQ.data ?? []).map((l) => [l.userId, l.name]));
  const cancelledHere = new Set((cancelsQ.data ?? []).filter((c) => c.session_id === currentSessionId).map((c) => c.learner_id));

  const teacherCancel = async (userId: string, name: string) => {
    if (!currentSessionId) return;
    const reason = prompt(`Cancel ${name}'s attempt at this Session? Their marks here are wiped and removed from totals (one cancel per Session). Reason (optional):`);
    if (reason === null) return;
    try {
      await cancelSessionAttempt(currentSessionId, userId, reason);
      toast.success(`${name}'s attempt was cancelled.`);
      await Promise.all([learnersQ.refetch(), cancelsQ.refetch()]);
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{scope ? `${scope.label} progress` : "Progress"}</DialogTitle></DialogHeader>
        {scopeQ.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
        ) : !scope ? (
          <p className="py-10 text-center text-sm text-muted-foreground">This subject could not be found.</p>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Only {scope.label} counts here — other classes and subjects are kept separate. Cancelled attempts are not counted.
            </p>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">How far you have gone</h3>
                <PerformanceTabs value={view} onChange={setView} />
              </div>
              {mineQ.data ? (
                <>
                  <ProgressSummary report={reportFor(scope, mineQ.data)} label={scope.label} view={view} />
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-left">
                        <tr><th className="p-2">Session</th><th className="p-2">Beginner</th><th className="p-2">Intermediate</th><th className="p-2">Expert</th></tr>
                      </thead>
                      <tbody>
                        {reportFor(scope, mineQ.data).sessions.map((s) => (
                          <tr key={s.id} className={`border-t border-border ${s.id === currentSessionId ? "bg-primary/5" : ""}`}>
                            <td className="p-2 font-medium">{s.title}</td>
                            {s.tiers.map((t) => (
                              <td key={t.tier} className={`p-2 ${t.status === "not_started" ? "text-muted-foreground" : ""}`}>{t.label}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Loading…</p>
              )}
            </section>

            {scope.canBuild && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Learners in {scope.label}</h3>
                {learnersQ.isLoading ? (
                  <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Loading…</p>
                ) : !(learnersQ.data ?? []).length ? (
                  <p className="text-xs text-muted-foreground">No learner has started this subject yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="p-2">Learner</th>
                          <th className="p-2" title="Beginner">Beg.</th>
                          <th className="p-2" title="Intermediate">Int.</th>
                          <th className="p-2" title="Expert">Exp.</th>
                          <th className="p-2" title="Marks earned divided by marks possible, including work with no tier">Overall</th>
                          {currentSessionId && <th className="p-2">This Session (B / I / E)</th>}
                          {currentSessionId && <th className="p-2" />}
                        </tr>
                      </thead>
                      <tbody>
                        {(learnersQ.data ?? []).map((l) => {
                          const here = l.report.sessions.find((s) => s.id === currentSessionId);
                          const started = !!here?.tiers.some((t) => t.status !== "not_started");
                          return (
                            <tr key={l.userId} className="border-t border-border">
                              <td className="p-2 font-medium">{l.name}</td>
                              {TIERS.map((tier) => {
                                const step = l.report.ladder.find((s) => s.tier === tier);
                                const tierStarted = (step?.sessionsAttempted ?? 0) > 0;
                                return <td key={tier} className="p-2">{tierStarted ? `${percent(step!.attemptedScore, step!.attemptedMax)}%` : "—"}</td>;
                              })}
                              <td className="p-2">{(() => {
                                const overall = reportView(l.report, "overall");
                                return overall.started ? `${overall.score}/${overall.max} (${percent(overall.score, overall.max)}%)` : "—";
                              })()}</td>
                              {currentSessionId && <td className="p-2">{here ? here.tiers.map((t) => t.status === "not_started" ? "—" : t.label).join(" / ") : "—"}</td>}
                              {currentSessionId && (
                                <td className="p-2 text-right">
                                  {cancelledHere.has(l.userId) ? (
                                    <span className="text-muted-foreground">Cancel used</span>
                                  ) : started ? (
                                    <Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void teacherCancel(l.userId, l.name)}>
                                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Cancel
                                    </Button>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="pt-2 text-sm font-semibold">Cancel log</h3>
                {!(cancelsQ.data ?? []).length ? (
                  <p className="text-xs text-muted-foreground">No attempts have been cancelled in {scope.label}.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {(cancelsQ.data ?? []).map((c) => (
                      <li key={c.id} className="rounded-lg border border-border px-3 py-2">
                        <span className="font-medium">{nameOf.get(c.learner_id) ?? "Learner"}</span>
                        {" · "}{titleOf.get(c.session_id) ?? "Session"}
                        {" · cancelled by "}{c.cancelled_by_role === "teacher" ? "a teacher" : "the learner"}
                        {" · "}{new Date(c.created_at).toLocaleString()}
                        {c.snapshot?.length ? ` · wiped: ${c.snapshot.filter((x) => x.mode === "practice").map((x) => `${isTier(x.tier) ? TIER_LABEL[x.tier] : "no tier"} ${x.best_score}/${x.max_score}`).join(", ") || "play only"}` : ""}
                        {c.reason ? ` · “${c.reason}”` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassSubjectProgressDialog;
