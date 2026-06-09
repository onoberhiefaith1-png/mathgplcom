// Student Assessment Board — a Floating-Number assessment workspace.
//
// The student receives only the question + shuffled floating chips + per-line
// marks. They rearrange chips to rebuild each line; the server grades the
// arrangement (the correct answer never reaches this client) and awards marks
// line-by-line. Progress + score are saved and restored automatically.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, RotateCcw, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { extractTermsFromAscii, renderTermLabel } from "@/lib/smartboard/floatingExtractor";

interface QLine { lineId: string; chips: string[]; marks: number }
interface Question { id: string; questionText: string; lines: QLine[] }
interface Assessment {
  id: string;
  title: string;
  kind: string;
  score_label: string;
  total_marks: number;
  questions: Question[];
}

type LineState = { builtIdx: number[]; status: "idle" | "wrong" | "solved" };

const slotKey = (qId: string, lineId: string) => `${qId}:${lineId}`;

const chipLabel = (token: string): string => {
  const cleaned = toUnicodeMath(token);
  if (!cleaned || isStillDirty(cleaned)) return token;
  const term = extractTermsFromAscii(cleaned)[0];
  return term ? renderTermLabel(term, { isFirst: false, prevWasEquals: false }) : cleaned;
};

const AssessmentBoardPage = () => {
  const { classId, assessmentId } = useParams<{ classId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({});
  const [solved, setSolved] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [checking, setChecking] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ---- Load assessment + restore progress -------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!assessmentId || !classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/assessment/${assessmentId}`);
        return;
      }
      const { data: a } = await supabase
        .from("assessments")
        .select("id, title, kind, score_label, total_marks, questions")
        .eq("id", assessmentId)
        .maybeSingle();
      if (!a) { navigate(`/student/class/${classId}`); return; }

      // Ensure a progress row exists, then read it for restore.
      await supabase
        .from("assessment_progress")
        .upsert(
          { assessment_id: assessmentId, student_id: userData.user.id, status: "in_progress" },
          { onConflict: "assessment_id,student_id", ignoreDuplicates: true },
        );
      const { data: prog } = await supabase
        .from("assessment_progress")
        .select("solved_lines, score")
        .eq("assessment_id", assessmentId)
        .eq("student_id", userData.user.id)
        .maybeSingle();

      if (cancelled) return;
      const assess = a as unknown as Assessment;
      setAssessment(assess);
      const solvedMap = ((prog?.solved_lines as Record<string, number>) ?? {});
      setSolved(solvedMap);
      setScore(Number(prog?.score ?? 0));

      // Mark restored lines as solved in the per-line UI state.
      const init: Record<string, LineState> = {};
      for (const q of assess.questions ?? []) {
        for (const l of q.lines ?? []) {
          const k = slotKey(q.id, l.lineId);
          init[k] = { builtIdx: [], status: k in solvedMap ? "solved" : "idle" };
        }
      }
      setLineStates(init);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assessmentId, classId, navigate]);

  // ---- Live score updates (e.g. multi-device) ---------------------------
  useEffect(() => {
    if (!assessmentId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-progress-${assessmentId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress", filter: `assessment_id=eq.${assessmentId}` },
          (payload) => {
            const row = payload.new as { solved_lines?: Record<string, number>; score?: number } | null;
            if (!row) return;
            setSolved(row.solved_lines ?? {});
            setScore(Number(row.score ?? 0));
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentId]);

  const question = assessment?.questions?.[qIdx];

  const tapChip = useCallback((k: string, idx: number) => {
    setLineStates((prev) => {
      const st = prev[k] ?? { builtIdx: [], status: "idle" };
      if (st.status === "solved") return prev;
      if (st.builtIdx.includes(idx)) return prev;
      return { ...prev, [k]: { builtIdx: [...st.builtIdx, idx], status: "idle" } };
    });
  }, []);

  const removeBuilt = useCallback((k: string, pos: number) => {
    setLineStates((prev) => {
      const st = prev[k];
      if (!st || st.status === "solved") return prev;
      const next = st.builtIdx.filter((_, i) => i !== pos);
      return { ...prev, [k]: { builtIdx: next, status: "idle" } };
    });
  }, []);

  const resetLine = useCallback((k: string) => {
    setLineStates((prev) => ({ ...prev, [k]: { builtIdx: [], status: "idle" } }));
  }, []);

  const checkLine = useCallback(async (q: Question, line: QLine) => {
    const k = slotKey(q.id, line.lineId);
    const st = lineStates[k];
    if (!st || st.builtIdx.length === 0) return;
    const arrangement = st.builtIdx.map((i) => line.chips[i]);
    setChecking(k);
    try {
      const { data, error } = await supabase.functions.invoke("grade-assessment", {
        body: { assessmentId, questionId: q.id, lineId: line.lineId, arrangement },
      });
      if (error) throw error;
      const res = data as { correct: boolean; score: number; solvedLines: Record<string, number> };
      if (res.correct) {
        setSolved(res.solvedLines ?? {});
        setScore(Number(res.score ?? 0));
        setLineStates((prev) => ({ ...prev, [k]: { builtIdx: st.builtIdx, status: "solved" } }));
        toast({ title: "Correct!", description: `+${line.marks} ${assessment?.score_label ?? "Marks"}` });
      } else {
        setLineStates((prev) => ({ ...prev, [k]: { ...st, status: "wrong" } }));
      }
    } catch (e: any) {
      toast({ title: "Could not check", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setChecking(null);
    }
  }, [assessmentId, lineStates, assessment]);

  const saveProgress = useCallback(async () => {
    if (!assessmentId) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from("assessment_progress")
        .upsert(
          {
            assessment_id: assessmentId,
            student_id: userData.user.id,
            solved_lines: solved,
            score,
            status: assessment && assessment.total_marks > 0 && score >= assessment.total_marks ? "completed" : "in_progress",
          },
          { onConflict: "assessment_id,student_id" },
        );
    }
    setSaving(false);
    toast({ title: "Progress saved" });
  }, [assessmentId, solved, score, assessment]);

  const totalSolved = useMemo(() => Object.keys(solved).length, [solved]);
  const totalLines = useMemo(
    () => (assessment?.questions ?? []).reduce((n, q) => n + (q.lines?.length ?? 0), 0),
    [assessment],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening assignment…
      </div>
    );
  }
  if (!assessment || !question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Assignment not found.
      </div>
    );
  }

  const label = assessment.score_label || "Marks";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate(`/student/class/${classId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold">{assessment.title}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{assessment.kind}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums text-primary">
              {score} <span className="text-sm text-muted-foreground">/ {assessment.total_marks}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          </div>
          <button
            onClick={saveProgress}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
        {/* Question navigator */}
        {assessment.questions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {assessment.questions.map((q, i) => {
              const done = (q.lines ?? []).every((l) => slotKey(q.id, l.lineId) in solved);
              return (
                <button
                  key={q.id}
                  onClick={() => setQIdx(i)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
                  style={i === qIdx
                    ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                    : {}}
                >
                  Q{i + 1} {done && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Question */}
        <section className="rounded-xl border border-border bg-card/40 p-5">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Question</div>
          <div className="text-lg">{renderMathInline(question.questionText, `q-${question.id}`)}</div>
        </section>

        {/* Progress tracker */}
        <section className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</div>
            <div className="text-xs text-muted-foreground tabular-nums">{totalSolved} / {totalLines} lines</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {question.lines.map((l, i) => {
              const done = slotKey(question.id, l.lineId) in solved;
              return (
                <div
                  key={l.lineId}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
                  style={done ? { borderColor: "hsl(142 70% 45%)", color: "hsl(142 70% 40%)" } : {}}
                >
                  Line {i + 1} {done ? <Check className="h-3.5 w-3.5" /> : <span className="opacity-40">▢</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lines workspace */}
        <section className="space-y-4">
          {question.lines.map((line, li) => {
            const k = slotKey(question.id, line.lineId);
            const st = lineStates[k] ?? { builtIdx: [], status: "idle" };
            const isSolved = st.status === "solved" || k in solved;
            const usedIdx = new Set(st.builtIdx);
            return (
              <div
                key={line.lineId}
                className="rounded-xl border bg-card/40 p-4"
                style={isSolved ? { borderColor: "hsl(142 70% 45% / 0.5)" } : {}}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Line {li + 1}
                  </div>
                  <div className="text-xs text-muted-foreground">{line.marks} {label}</div>
                </div>

                {isSolved ? (
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "hsl(142 70% 40%)" }}>
                    <Check className="h-4 w-4" /> Solved — earned {line.marks} {label}
                  </div>
                ) : (
                  <>
                    {/* Build row */}
                    <div className="mb-3 flex min-h-[44px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
                      {st.builtIdx.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Tap chips below to build this line…</span>
                      ) : (
                        st.builtIdx.map((idx, pos) => (
                          <button
                            key={`b-${pos}`}
                            onClick={() => removeBuilt(k, pos)}
                            className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[15px] hover:bg-primary/20"
                            title="Remove"
                          >
                            {renderMathInline(chipLabel(line.chips[idx]), `bl-${k}-${pos}`)}
                          </button>
                        ))
                      )}
                    </div>

                    {/* Available chips */}
                    <div className="flex flex-wrap gap-2">
                      {line.chips.map((c, idx) => (
                        <button
                          key={`c-${idx}`}
                          disabled={usedIdx.has(idx)}
                          onClick={() => tapChip(k, idx)}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-[15px] transition hover:border-primary/50 disabled:opacity-30"
                        >
                          {renderMathInline(chipLabel(c), `ch-${k}-${idx}`)}
                        </button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => checkLine(question, line)}
                        disabled={st.builtIdx.length === 0 || checking === k}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {checking === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Check
                      </button>
                      <button
                        onClick={() => resetLine(k)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        <RotateCcw className="h-4 w-4" /> Reset
                      </button>
                      {st.status === "wrong" && (
                        <span className="inline-flex items-center gap-1 text-sm" style={{ color: "hsl(0 70% 55%)" }}>
                          <X className="h-4 w-4" /> Not quite — try a different arrangement.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default AssessmentBoardPage;
