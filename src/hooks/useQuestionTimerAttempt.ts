// Per-question timed attempt layer.
//
// This is a SECOND, TEMPORARY layer that sits on top of the permanent marking
// system. It never grades anything and it never touches `assessment_progress`:
//
//   permanent achievement → assessment_progress.solved_lines / score
//   current attempt       → assessment_timer_attempts (this hook)
//
// One active attempt row per (assessment, student, question). The timer starts
// at the student's first real input, pauses when they leave, resumes when they
// return, and only Reset creates a new attempt.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchQuestionBestTimes } from "@/lib/assessments/bestTimes";


// `assessment_timer_attempts` ships with this change, so the generated types
// do not know it yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

export type TimerAttemptRow = {
  id: string;
  attempt_no: number;
  started_at: string | null;
  elapsed_ms: number;
  running: boolean;
  attempt_lines: Record<string, number>;
  completed_at: string | null;
  success: boolean;
};

export type QuestionTimerAttempt = {
  /** Timer layer is live (teacher enabled it, real student sitting). */
  active: boolean;
  ready: boolean;
  attemptNo: number;
  /** Elapsed working time of the CURRENT attempt, in ms. */
  elapsedMs: number;
  running: boolean;
  /** Shortest verified successful attempt for this question, in ms. */
  bestMs: number | null;
  /** Fastest verified time for this question by ANYONE (guests included). */
  overallBestMs: number | null;

  /** Lines confirmed correct in THIS attempt: slot → marks. */
  confirmed: Record<string, number>;
  markInput: () => void;
  confirmLine: (slot: string, marks: number) => void;
  complete: () => void;
  reset: () => Promise<void>;
};

/** HH:MM:SS — hours never roll over into days. */
export const formatAttemptTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

export function useQuestionTimerAttempt(opts: {
  enabled: boolean;
  assessmentId?: string | null;
  studentId?: string | null;
  questionId?: string | null;
}): QuestionTimerAttempt {
  const { enabled, assessmentId, studentId, questionId } = opts;
  const active = !!(enabled && assessmentId && studentId && questionId);

  const [ready, setReady] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [attemptNo, setAttemptNo] = useState(1);
  const [baseMs, setBaseMs] = useState(0);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [overallBestMs, setOverallBestMs] = useState<number | null>(null);
  /** Bumped whenever a valid attempt completes, so the benchmark re-reads. */
  const [bestStamp, setBestStamp] = useState(0);


  const [completed, setCompleted] = useState(false);
  const [tick, setTick] = useState(0);

  const rowIdRef = useRef<string | null>(null);
  const baseRef = useRef(0);
  const sinceRef = useRef<number | null>(null);
  const confirmedRef = useRef<Record<string, number>>({});
  const completedRef = useRef(false);
  rowIdRef.current = rowId;
  baseRef.current = baseMs;
  sinceRef.current = runningSince;
  confirmedRef.current = confirmed;
  completedRef.current = completed;

  const elapsedMs = baseMs + (runningSince ? Math.max(0, Date.now() - runningSince) : 0);
  void tick; // the interval below drives re-render while running

  // ── Load the current attempt + best time ─────────────────────────────────
  useEffect(() => {
    if (!active) { setReady(false); return; }
    let cancelled = false;
    setReady(false);
    setRowId(null);
    setBaseMs(0);
    setRunningSince(null);
    setConfirmed({});
    setCompleted(false);

    (async () => {
      const { data: rows, error } = await db
        .from("assessment_timer_attempts")
        .select("id, attempt_no, started_at, elapsed_ms, running, attempt_lines, completed_at, success")
        .eq("assessment_id", assessmentId!)
        .eq("student_id", studentId!)
        .eq("question_id", questionId!)
        .order("attempt_no", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("[timer-attempt] load failed", error.message);
        setReady(true);
        return;
      }
      const all = (rows ?? []) as unknown as TimerAttemptRow[];
      const successes = all.filter((r) => r.success).map((r) => Number(r.elapsed_ms) || 0);
      setBestMs(successes.length ? Math.min(...successes) : null);

      const current = all[0] ?? null;
      if (current) {
        setRowId(current.id);
        setAttemptNo(Number(current.attempt_no) || 1);
        setBaseMs(Number(current.elapsed_ms) || 0);
        setConfirmed((current.attempt_lines ?? {}) as Record<string, number>);
        setCompleted(!!current.completed_at);
        // RETURNING RESUMES — the attempt is still active, so pick the clock
        // straight back up without waiting for another input.
        if (current.running && !current.completed_at) setRunningSince(Date.now());
        setReady(true);
        return;
      }

      const { data: created, error: insErr } = await db
        .from("assessment_timer_attempts")
        .insert({
          assessment_id: assessmentId!,
          student_id: studentId!,
          question_id: questionId!,
          attempt_no: 1,
        })
        .select("id, attempt_no")
        .maybeSingle();
      if (cancelled) return;
      if (insErr) console.warn("[timer-attempt] create failed", insErr.message);
      setRowId((created as { id?: string } | null)?.id ?? null);
      setAttemptNo(1);
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [active, assessmentId, studentId, questionId]);

  // ── Best times for THIS question ─────────────────────────────────────────
  // Two aggregates, no identities: my own fastest success, and the fastest
  // success by anyone (guests through public links included). Recalculated
  // whenever a new valid attempt lands (`bestStamp`).
  useEffect(() => {
    if (!active) { setOverallBestMs(null); return; }
    let cancelled = false;
    void fetchQuestionBestTimes(assessmentId!, questionId!).then((res) => {
      if (cancelled) return;
      setOverallBestMs(res.overallBestMs);
      if (res.myBestMs != null) setBestMs((prev) => (prev == null || res.myBestMs! < prev ? res.myBestMs : prev));
    });
    return () => { cancelled = true; };
  }, [active, assessmentId, questionId, bestStamp]);


  const patch = useCallback((fields: Record<string, unknown>) => {
    const id = rowIdRef.current;
    if (!id) return;
    void db
      .from("assessment_timer_attempts")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("[timer-attempt] save failed", error.message);
      });
  }, []);

  // Visible clock while running.
  useEffect(() => {
    if (!active || !runningSince) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [active, runningSince]);

  // Durable elapsed time while running, so a crash or hard refresh keeps it.
  useEffect(() => {
    if (!active || !runningSince) return;
    const id = window.setInterval(() => {
      const since = sinceRef.current;
      if (!since) return;
      patch({ elapsed_ms: baseRef.current + Math.max(0, Date.now() - since), running: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [active, runningSince, patch]);

  /** Fold the running segment into the stored total (LEAVING = PAUSE). */
  const pause = useCallback((persist: boolean) => {
    const since = sinceRef.current;
    if (!since) return;
    const total = baseRef.current + Math.max(0, Date.now() - since);
    baseRef.current = total;
    sinceRef.current = null;
    setBaseMs(total);
    setRunningSince(null);
    if (persist) patch({ elapsed_ms: total, running: true });
  }, [patch]);

  useEffect(() => {
    if (!active) return;
    const onHide = () => { if (document.visibilityState === "hidden") pause(true); };
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (completedRef.current) return;
      // The attempt is still active — resume without another input.
      if (sinceRef.current == null && (baseRef.current > 0 || Object.keys(confirmedRef.current).length > 0)) {
        sinceRef.current = Date.now();
        setRunningSince(sinceRef.current);
      }
    };
    const onUnload = () => pause(true);
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      pause(true);
    };
  }, [active, pause]);

  const markInput = useCallback(() => {
    if (!active || completedRef.current) return;
    if (sinceRef.current != null) return;
    sinceRef.current = Date.now();
    setRunningSince(sinceRef.current);
    patch({ running: true, started_at: new Date().toISOString() });
  }, [active, patch]);

  const confirmLine = useCallback((slot: string, marks: number) => {
    if (!active) return;
    if (slot in confirmedRef.current) return;
    const next = { ...confirmedRef.current, [slot]: marks };
    confirmedRef.current = next;
    setConfirmed(next);
    patch({ attempt_lines: next });
  }, [active, patch]);

  const complete = useCallback(() => {
    if (!active || completedRef.current) return;
    const since = sinceRef.current;
    const total = baseRef.current + (since ? Math.max(0, Date.now() - since) : 0);
    baseRef.current = total;
    sinceRef.current = null;
    completedRef.current = true;
    setBaseMs(total);
    setRunningSince(null);
    setCompleted(true);
    setBestMs((prev) => (prev == null || total < prev ? total : prev));
    patch({
      elapsed_ms: total,
      running: false,
      success: true,
      completed_at: new Date().toISOString(),
    });
  }, [active, patch]);

  /** RESET = start a new attempt. It never touches permanent achievement. */
  const reset = useCallback(async () => {
    if (!active) return;
    pause(true);
    const nextNo = attemptNo + 1;
    baseRef.current = 0;
    sinceRef.current = null;
    confirmedRef.current = {};
    completedRef.current = false;
    setBaseMs(0);
    setRunningSince(null);
    setConfirmed({});
    setCompleted(false);
    setAttemptNo(nextNo);
    const { data, error } = await db
      .from("assessment_timer_attempts")
      .insert({
        assessment_id: assessmentId!,
        student_id: studentId!,
        question_id: questionId!,
        attempt_no: nextNo,
      })
      .select("id")
      .maybeSingle();
    if (error) console.warn("[timer-attempt] new attempt failed", error.message);
    setRowId((data as { id?: string } | null)?.id ?? null);
  }, [active, assessmentId, studentId, questionId, attemptNo, pause]);

  return useMemo(
    () => ({
      active,
      ready,
      attemptNo,
      elapsedMs,
      running: runningSince != null,
      bestMs,
      overallBestMs,
      confirmed,
      markInput,
      confirmLine,
      complete,
      reset,
    }),
    [active, ready, attemptNo, elapsedMs, runningSince, bestMs, overallBestMs, confirmed, markInput, confirmLine, complete, reset],
  );

}

export default useQuestionTimerAttempt;
