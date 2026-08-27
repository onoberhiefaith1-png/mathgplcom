// Teacher control for the Assignment timer + the per-question Best Time board.
//
// The timer is a temporary attempt layer. Nothing here reads or writes marks:
// permanent achievement stays in the marking system.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Timer, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";

// The timer columns/table ship with this change, so generated types lack them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

type QuestionRef = { assessmentId: string; questionId: string; label: string };
type AttemptRow = {
  assessment_id: string;
  question_id: string;
  student_id: string;
  elapsed_ms: number;
  success: boolean;
};

/** Ranking with true ties sharing a position (1st, 1st, 3rd). */
export const rankByTime = <T extends { ms: number }>(rows: T[]): Array<T & { place: number }> => {
  const sorted = [...rows].sort((a, b) => a.ms - b.ms);
  const out: Array<T & { place: number }> = [];
  let place = 0;
  let prev: number | null = null;
  sorted.forEach((r, i) => {
    if (prev == null || r.ms !== prev) place = i + 1;
    prev = r.ms;
    out.push({ ...r, place });
  });
  return out;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AssignmentTimerPanel = ({
  assessmentIds,
  memberNames,
}: {
  assessmentIds: string[];
  memberNames: Map<string, string>;
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<QuestionRef[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  const idsKey = assessmentIds.join(",");

  const load = useCallback(async () => {
    if (assessmentIds.length === 0) { setLoading(false); return; }
    const { data: rows } = await db
      .from("assessments")
      .select("id, questions, timer_enabled, opens_at, closes_at")
      .in("id", assessmentIds);
    const list = (rows ?? []) as Array<{
      id: string;
      questions: Array<{ id: string; title?: string | null }> | null;
      timer_enabled: boolean | null;
      opens_at: string | null;
      closes_at: string | null;
    }>;
    const first = list[0];
    setEnabled(!!first?.timer_enabled);
    setOpensAt(toLocalInput(first?.opens_at ?? null));
    setClosesAt(toLocalInput(first?.closes_at ?? null));
    const qs: QuestionRef[] = [];
    for (const a of list) {
      (a.questions ?? []).forEach((q, i) => {
        qs.push({ assessmentId: a.id, questionId: q.id, label: q.title?.trim() || `Question ${i + 1}` });
      });
    }
    setQuestions(qs);

    const { data: att } = await db
      .from("assessment_timer_attempts")
      .select("assessment_id, question_id, student_id, elapsed_ms, success")
      .in("assessment_id", assessmentIds)
      .eq("success", true);
    setAttempts(((att ?? []) as AttemptRow[]));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (fields: Record<string, unknown>) => {
    if (assessmentIds.length === 0) return;
    const { error } = await db
      .from("assessments")
      .update({ ...fields })
      .in("id", assessmentIds);
    if (error) {
      toast({ title: "Could not save timer settings", description: error.message, variant: "destructive" });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, toast, load]);

  const boards = useMemo(() => {
    return questions.map((q) => {
      const best = new Map<string, number>();
      for (const a of attempts) {
        if (a.assessment_id !== q.assessmentId || a.question_id !== q.questionId) continue;
        const ms = Number(a.elapsed_ms) || 0;
        const prev = best.get(a.student_id);
        if (prev == null || ms < prev) best.set(a.student_id, ms);
      }
      const rows = rankByTime(
        Array.from(best.entries()).map(([studentId, ms]) => ({
          studentId,
          ms,
          name: memberNames.get(studentId) ?? "Student",
        })),
      );
      return { ...q, rows };
    });
  }, [questions, attempts, memberNames]);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Timer className="h-4 w-4" /> Assignment Timer
        </h2>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); void save({ timer_enabled: e.target.checked }); }}
            className="h-4 w-4 accent-primary"
          />
          Timer {enabled ? "ON" : "OFF"}
        </label>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        With the timer on, students see a second attempt row and a clock per question.
        Marks already earned are never awarded twice and never removed.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <div className="mb-1 text-muted-foreground">Opens</div>
          <input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => {
              setOpensAt(e.target.value);
              void save({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null });
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <div className="mb-1 text-muted-foreground">Closes</div>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => {
              setClosesAt(e.target.value);
              void save({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null });
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
        <Trophy className="h-4 w-4" /> Best Times
      </h3>
      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No questions in this assignment yet.
        </div>
      ) : (
        <div className="space-y-3">
          {boards.map((b) => (
            <div key={`${b.assessmentId}:${b.questionId}`} className="rounded-xl border border-border p-3">
              <div className="mb-2 text-xs font-medium">{b.label}</div>
              {b.rows.length === 0 ? (
                <div className="text-xs text-muted-foreground">No completed attempts yet.</div>
              ) : (
                <ol className="space-y-1">
                  {b.rows.map((r) => (
                    <li key={r.studentId} className="flex items-center justify-between text-xs">
                      <span>
                        <span className="mr-2 tabular-nums text-muted-foreground">{r.place}.</span>
                        {r.name}
                      </span>
                      <span className="tabular-nums font-semibold">{formatAttemptTime(r.ms)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AssignmentTimerPanel;
