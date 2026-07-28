// Teacher Mathematical Reasoning Panel — a narrow (~20%) debugging surface
// that shows, live, how the grader evaluates the CURRENT line the student is
// working on. It never rewrites student ink and never persists progress
// (all grading here is a dry run).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X as XIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { rowToAscii } from "@/lib/smartboard/rowAscii";

type KeyLine = { questionId: string; lineId: string; tokens: string[] };
type QuestionShape = { id: string; lines: Array<{ lineId: string; marks?: number }> };
type LivePayload = {
  ts: number;
  questionId: string | null;
  activeLineIdx: number;
  lineIds: Array<string | null>;
  rowsAscii: Record<number, string>;
  linesAscii: Record<string, string>;
  floatingTokens?: Record<string, string[]>;
};
type CheckPayload = {
  ts: number;
  questionId: string;
  lineId: string;
  mode: "manual" | "auto";
  correct: boolean;
  verdict?: string;
  diagnosis?: DiagnosisShape;
  marks?: number;
  studentAscii?: string;
};
type DiagnosisShape = { code: string; label: string; detail: string };
type Verdict = {
  correct: boolean;
  verdict: string;
  diagnosis?: DiagnosisShape;
  marks: number;
  teacherAscii?: string;
};

const verdictLabel = (v: string): string => {
  switch (v) {
    case "equal": return "Mathematically equivalent to the expected step.";
    case "not_equal": return "Not mathematically equivalent to the expected step.";
    case "not_in_floating_set": return "Uses a token that was not in this line's floating numbers.";
    case "parse_error": return "Could not read the expression — check brackets or stray symbols.";
    default: return v || "—";
  }
};

const atomize = (s: string): string[] =>
  (s.match(/[A-Za-z]+|\d+(?:\.\d+)?/g) ?? []).map((t) => t.toLowerCase());

interface Props {
  assessmentId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

const TeacherReasoningPanel = ({ assessmentId, studentId, studentName, onClose }: Props) => {
  const [questions, setQuestions] = useState<QuestionShape[]>([]);
  const [keyLines, setKeyLines] = useState<KeyLine[]>([]);
  const [progress, setProgress] = useState<{ solved_lines: Record<string, number>; score: number } | null>(null);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [fallback, setFallback] = useState<LivePayload | null>(null);
  const [fallbackAt, setFallbackAt] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckPayload | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [, forceTick] = useState(0);

  const liveAtRef = useRef<number>(0);

  // Repaint the freshness indicator once a second.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Assessment shape + answer key.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: a }, { data: k }] = await Promise.all([
        supabase.from("assessments").select("questions").eq("id", assessmentId).maybeSingle(),
        supabase.from("assessment_answer_keys").select("lines").eq("assessment_id", assessmentId).maybeSingle(),
      ]);
      if (cancelled) return;
      setQuestions(((a?.questions as unknown) as QuestionShape[]) ?? []);
      setKeyLines(((k?.lines as unknown) as KeyLine[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [assessmentId]);

  // ── Progress (awarded marks). Refreshed on open, on every check event and
  // on a light interval — no private realtime channel involved. ────────────
  const refreshProgress = useCallback(async () => {
    const { data } = await supabase
      .from("assessment_progress")
      .select("solved_lines, score")
      .eq("assessment_id", assessmentId)
      .eq("student_id", studentId)
      .maybeSingle();
    setProgress({
      solved_lines: (data?.solved_lines as Record<string, number>) ?? {},
      score: Number(data?.score ?? 0),
    });
  }, [assessmentId, studentId]);

  useEffect(() => {
    void refreshProgress();
    const id = window.setInterval(() => { void refreshProgress(); }, 4000);
    return () => window.clearInterval(id);
  }, [refreshProgress]);

  // ── Durable fallback: the persisted board state row. Used whenever no
  // broadcast has arrived recently (idle / offline student). ───────────────
  const loadFallback = useCallback(async () => {
    const { data } = await supabase
      .from("assessment_board_state")
      .select("state_json, question_id, active_line_idx, updated_at")
      .eq("assessment_id", assessmentId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!data) return;
    const sj = (data.state_json ?? {}) as {
      freeLines?: Record<string, unknown[]>;
      sensor?: { line?: number };
      activeLineIdx?: number;
      questionId?: string | null;
    };
    const activeLineIdx = Math.max(0, Math.floor(data.active_line_idx ?? sj.activeLineIdx ?? 0));
    const questionId = (data.question_id as string | null) ?? sj.questionId ?? null;
    const rowsAscii: Record<number, string> = {};
    for (const [k, v] of Object.entries(sj.freeLines ?? {})) {
      const n = Number(k);
      if (!Number.isFinite(n)) continue;
      if (Array.isArray(v) && v.length > 0) {
        try { rowsAscii[n] = rowToAscii(v as never); } catch { /* ignore */ }
      }
    }
    const cursorRow = Math.floor(sj.sensor?.line ?? -1);
    const cursorAscii = rowsAscii[cursorRow] ?? "";
    setFallback({
      ts: new Date(data.updated_at as string).getTime(),
      questionId,
      activeLineIdx,
      lineIds: [],
      rowsAscii,
      linesAscii: cursorAscii ? { __cursor: cursorAscii } : {},
    });
    setFallbackAt(new Date(data.updated_at as string).getTime());
  }, [assessmentId, studentId]);

  useEffect(() => {
    void loadFallback();
    const id = window.setInterval(() => {
      // Only poll while the live feed is stale.
      if (Date.now() - liveAtRef.current > 5000) void loadFallback();
    }, 3000);
    return () => window.clearInterval(id);
  }, [loadFallback]);

  // ── Live board broadcast from the student's Smartboard. ──────────────────
  useEffect(() => {
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-live-${assessmentId}-${studentId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "board" }, (msg) => {
          const p = (msg as { payload?: LivePayload }).payload;
          if (!p) return;
          liveAtRef.current = Date.now();
          setLive(p);
        })
        .on("broadcast", { event: "check" }, (msg) => {
          const p = (msg as { payload?: CheckPayload }).payload;
          if (!p) return;
          setLastCheck(p);
          void refreshProgress();
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentId, studentId, refreshProgress]);

  const isLive = Date.now() - liveAtRef.current < 6000 && !!live;
  const feed = isLive ? live : (live ?? fallback);
  const usingFallback = !isLive && !!fallback && !live;

  // ── The CURRENT line — always follows the student's cursor. ──────────────
  const currentQid = feed?.questionId ?? null;
  const currentQ = useMemo(() => questions.find((q) => q.id === currentQid) ?? null, [questions, currentQid]);
  const questionNo = useMemo(() => questions.findIndex((q) => q.id === currentQid) + 1, [questions, currentQid]);
  const activeIdx = Math.max(0, Math.floor(feed?.activeLineIdx ?? 0));
  const lineNo = activeIdx + 1;

  const currentLid = useMemo(() => {
    if (!feed) return null;
    const fromBroadcast = feed.lineIds?.[activeIdx] ?? null;
    if (fromBroadcast) return fromBroadcast;
    return currentQ?.lines?.[activeIdx]?.lineId ?? null;
  }, [feed, activeIdx, currentQ]);

  const expectedAscii = useMemo(() => {
    const k = keyLines.find((x) => x.questionId === currentQid && x.lineId === currentLid);
    return (k?.tokens ?? []).join(" ").trim();
  }, [keyLines, currentQid, currentLid]);

  const studentAscii = useMemo(() => {
    if (!feed) return "";
    if (currentLid && feed.linesAscii?.[currentLid] != null) return feed.linesAscii[currentLid];
    return feed.linesAscii?.__cursor ?? "";
  }, [feed, currentLid]);

  const allowedTokens = useMemo(() => {
    if (!currentLid || !feed?.floatingTokens) return undefined;
    return feed.floatingTokens[currentLid];
  }, [feed, currentLid]);

  const invalidTokens = useMemo(() => {
    if (!allowedTokens || allowedTokens.length === 0 || !studentAscii.trim()) return [];
    const allowed = new Set(allowedTokens.flatMap(atomize));
    return Array.from(new Set(atomize(studentAscii).filter((a) => !allowed.has(a))));
  }, [allowedTokens, studentAscii]);

  const awardedMarks = useMemo(() => {
    if (!currentQid || !currentLid) return 0;
    return Number(progress?.solved_lines?.[`${currentQid}:${currentLid}`] ?? 0);
  }, [progress, currentQid, currentLid]);

  const lineMarks = useMemo(() => {
    const l = currentQ?.lines?.find((x) => x.lineId === currentLid);
    return Number(l?.marks ?? 0);
  }, [currentQ, currentLid]);

  // Reset the evaluation whenever the student moves to a different line —
  // one line is one page.
  useEffect(() => {
    setVerdict(null);
  }, [currentLid, currentQid]);

  // Dry-run grade whenever the current line's content changes.
  const debounceRef = useRef<number | null>(null);
  const runDryGrade = useCallback(async () => {
    if (!currentQid || !currentLid || studentAscii.trim().length === 0) {
      setVerdict(null);
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-line", {
        body: {
          assessmentId,
          questionId: currentQid,
          lineId: currentLid,
          studentAscii,
          mode: "manual",
          allowedFloatingTokens: allowedTokens,
          persist: false,
        },
      });
      if (error) throw error;
      setVerdict(data as Verdict);
    } catch {
      setVerdict(null);
    } finally {
      setChecking(false);
    }
  }, [assessmentId, currentQid, currentLid, studentAscii, allowedTokens]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void runDryGrade(); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [runDryGrade]);

  // The check event wins when it refers to the line currently on screen.
  const checkForThisLine =
    lastCheck && lastCheck.questionId === currentQid && lastCheck.lineId === currentLid ? lastCheck : null;
  const shownCorrect = checkForThisLine ? checkForThisLine.correct : verdict?.correct ?? null;
  const shownVerdict = checkForThisLine?.verdict ?? verdict?.verdict ?? null;
  const shownDiagnosis: DiagnosisShape | null =
    (checkForThisLine?.diagnosis ?? verdict?.diagnosis) ?? null;
  const sourceBadge = checkForThisLine
    ? checkForThisLine.mode === "manual" ? "student Check" : "auto check"
    : verdict ? "live dry run" : null;

  return (
    <div className="flex h-full flex-col border-l border-border bg-background text-foreground">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span>🧠</span> Reasoning
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{studentName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close reasoning panel"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">
        {!feed ? (
          <div className="text-xs text-muted-foreground">
            Waiting for the student's board… the current line appears here as soon as they open it.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Question {questionNo > 0 ? questionNo : "—"} · Line {lineNo}</span>
              <span className="tabular-nums">
                {isLive ? (
                  <span className="text-emerald-500">live</span>
                ) : usingFallback && fallbackAt ? (
                  `saved ${Math.max(0, Math.floor((Date.now() - fallbackAt) / 1000))}s ago`
                ) : (
                  `t+${Math.max(0, Math.floor((Date.now() - (feed.ts || Date.now())) / 1000))}s`
                )}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Expected line</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-sm">
                {expectedAscii || <span className="italic text-muted-foreground">no answer key</span>}
              </pre>
            </div>

            <div className="rounded-lg border border-border bg-card/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Student line (live)</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-sm">
                {studentAscii || <span className="italic text-muted-foreground">nothing written yet</span>}
              </pre>
            </div>

            <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI evaluation</div>
                {sourceBadge && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {sourceBadge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {checking && !checkForThisLine ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> Waiting…</>
                ) : shownCorrect === true ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {shownDiagnosis?.label ?? "Equivalent"}</>
                ) : shownCorrect === false ? (
                  <><XCircle className="h-4 w-4 text-red-500" /> {shownDiagnosis?.label ?? "Not equivalent"}</>
                ) : (
                  <span className="text-muted-foreground">Waiting…</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {shownDiagnosis?.detail ?? (shownVerdict ? verdictLabel(shownVerdict) : "No line content to evaluate yet.")}
              </div>
              <div className="text-xs tabular-nums">
                Awarded <span className="font-semibold">{awardedMarks}</span>
                <span className="text-muted-foreground">/{lineMarks}</span>
              </div>
            </div>

            {allowedTokens && allowedTokens.length > 0 && (
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Floating numbers for this line
                </div>
                <div className="flex flex-wrap gap-1">
                  {allowedTokens.map((t, i) => (
                    <span key={`${t}-${i}`} className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
                {invalidTokens.length > 0 ? (
                  <div className="mt-2 text-[11px] text-red-500">
                    Not in the floating set: <span className="font-mono">{invalidTokens.join(", ")}</span>
                  </div>
                ) : (
                  studentAscii.trim() && (
                    <div className="mt-2 text-[11px] text-emerald-500">Only available floating numbers used.</div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherReasoningPanel;
