// Teacher Mathematical Reasoning Panel — a narrow (~20%) debugging surface
// that shows, live, how the grader evaluates the CURRENT line the student is
// working on. It never rewrites student ink and never persists progress
// (all grading here is a dry run).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X as XIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import { PresenterMath, toDisplaySafe } from "./PresenterMath";

type KeyLine = { questionId: string; lineId: string; tokens: string[]; equationAscii?: string };

type QuestionShape = { id: string; lines: Array<{ lineId: string; marks?: number }> };
type LivePayload = {
  ts: number;
  questionId: string | null;
  activeLineIdx: number;
  lineIds: Array<string | null>;
  rowsAscii: Record<number, string>;
  linesAscii: Record<string, string>;
  floatingTokens?: Record<string, string[]>;
  /** Reasoning-engine view of the ONE active line. */
  activeRow?: number | null;
  attempt?: number;
  introducedTerms?: string[];
};
type CheckPayload = {
  ts: number;
  questionId: string;
  lineId: string;
  mode: "manual" | "auto" | "live";
  correct: boolean;
  verdict?: string;
  diagnosis?: DiagnosisShape;
  marks?: number;
  studentAscii?: string;
};
type DiagnosisShape = { code: string; label: string; detail: string };
const verdictLabel = (v: string): string => {
  switch (v) {
    case "equal": return "Mathematically equivalent to the expected step.";
    case "not_equal": return "Not mathematically equivalent to the expected step.";
    case "parse_error": return "Could not read the expression — check brackets or stray symbols.";
    default: return v || "—";
  }
};

const atomize = (s: string): string[] =>
  (s.match(/[A-Za-z]+|\d+(?:\.\d+)?/g) ?? []).map((t) => t.toLowerCase());

/** A viewer for ONE mathematical line.
 *
 *  Vertical: unbounded — the block grows downward and everything below it
 *  simply moves down (the panel's own scrollbar handles the page).
 *  Horizontal: the width is FIXED. When the rendered expression is wider than
 *  the box, the whole rendering is uniformly scaled down until it fits, so the
 *  maths is never cropped, never overflows and never reflows. */
const LineViewer = ({
  label,
  right,
  children,
  resetKey,
  sticky = false,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  resetKey: string;
  sticky?: boolean;
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    if (!frame || !inner) return;
    const fit = () => {
      const avail = frame.clientWidth;
      const natural = inner.scrollWidth;
      const k = natural > 0 && avail > 0 ? Math.min(1, Math.max(0.35, avail / natural)) : 1;
      setScale(k);
      setHeight(inner.scrollHeight * k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [resetKey, children]);

  return (
    <div
      className={`rounded-lg border border-border bg-card/95 p-3 backdrop-blur ${
        sticky ? "sticky top-0 z-10 shadow-sm" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        {right}
      </div>
      <div ref={frameRef} className="w-full overflow-hidden" style={{ height }}>
        <div
          ref={innerRef}
          className="inline-block whitespace-nowrap text-[15px] leading-relaxed"
          style={{ transform: `scale(${scale})`, transformOrigin: "left top" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};


interface Props {
  assessmentId: string;
  studentId: string;
  /** The question board being reviewed. Durable fallback state is read per
   *  question so one question's work can never be shown under another. */
  questionId?: string | null;
  studentName: string;
  onClose: () => void;
  /** Dedicated Reasoning full screen (independent of the Smartboard's). */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const TeacherReasoningPanel = ({
  assessmentId,
  studentId,
  questionId: scopeQuestionId = null,
  studentName,
  onClose,
  fullscreen = false,
  onToggleFullscreen,
}: Props) => {

  const [questions, setQuestions] = useState<QuestionShape[]>([]);
  const [keyLines, setKeyLines] = useState<KeyLine[]>([]);
  const [progress, setProgress] = useState<{ solved_lines: Record<string, number>; score: number } | null>(null);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [fallback, setFallback] = useState<LivePayload | null>(null);
  const [fallbackAt, setFallbackAt] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckPayload | null>(null);
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
    // Per-question board first — that is where students actually write. The
    // legacy shared row is only read when it belongs to THIS question.
    let row:
      | { state_json: unknown; question_id: string | null; active_line_idx: number | null; updated_at: string }
      | null = null;

    if (scopeQuestionId) {
      const { data } = await supabase
        .from("assessment_question_board_state")
        .select("state_json, question_id, active_line_idx, updated_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .eq("question_id", scopeQuestionId)
        .maybeSingle();
      row = (data as typeof row) ?? null;
    }

    if (!row) {
      const { data } = await supabase
        .from("assessment_board_state")
        .select("state_json, question_id, active_line_idx, updated_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      const legacy = (data as typeof row) ?? null;
      const legacyQid = legacy?.question_id ?? null;
      // Never show another question's work under this one.
      row = legacy && (!scopeQuestionId || legacyQid === scopeQuestionId) ? legacy : null;
    }

    if (!row) { setFallback(null); setFallbackAt(null); return; }

    const sj = (row.state_json ?? {}) as {
      freeLines?: Record<string, unknown[]>;
      sensor?: { line?: number };
      activeLineIdx?: number;
      questionId?: string | null;
    };
    const activeLineIdx = Math.max(0, Math.floor(row.active_line_idx ?? sj.activeLineIdx ?? 0));
    const questionId = row.question_id ?? sj.questionId ?? scopeQuestionId ?? null;
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
      ts: new Date(row.updated_at).getTime(),
      questionId,
      activeLineIdx,
      lineIds: [],
      rowsAscii,
      linesAscii: cursorAscii ? { __cursor: cursorAscii } : {},
    });
    setFallbackAt(new Date(row.updated_at).getTime());
  }, [assessmentId, studentId, scopeQuestionId]);


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

  // Expected line = the TEACHER'S authored equation (the orange normal-mode
  // presenter line) and nothing else. It is NEVER reconstructed from the
  // floating-number list — those are only an input source for the student.
  const expectedAscii = useMemo(() => {
    const k = keyLines.find((x) => x.questionId === currentQid && x.lineId === currentLid);
    return toDisplaySafe(k?.equationAscii);
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

  // Terms the student introduced themselves (not supplied by the teacher for
  // this line). The engine computes these; we only fall back locally when an
  // older client is broadcasting.
  const studentAddedTerms = useMemo(() => {
    if (Array.isArray(feed?.introducedTerms)) return feed!.introducedTerms;
    return invalidTokens;
  }, [feed, invalidTokens]);

  const attemptNo = Math.max(1, Math.floor(feed?.attempt ?? 1));
  const activeRow = feed?.activeRow ?? null;

  // Reasoning is a live monitoring tool only — everything is discarded the
  // moment the student moves to another line or another question.
  useEffect(() => {
    setLastCheck(null);
  }, [currentLid, currentQid]);

  // The panel NEVER grades. The student's reasoning engine is the single
  // source of truth and broadcasts every evaluation (live, Check and silent
  // auto-marking), so what we show can never disagree with what was awarded.
  const checkForThisLine =
    lastCheck && lastCheck.questionId === currentQid && lastCheck.lineId === currentLid ? lastCheck : null;
  const shownCorrect = checkForThisLine ? checkForThisLine.correct : null;
  const shownVerdict = checkForThisLine?.verdict ?? null;
  const shownDiagnosis: DiagnosisShape | null = checkForThisLine?.diagnosis ?? null;
  const sourceBadge = checkForThisLine
    ? checkForThisLine.mode === "manual"
      ? "student Check"
      : checkForThisLine.mode === "auto"
        ? "auto check"
        : "live reasoning"
    : null;

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
              <span>
                Question {questionNo > 0 ? questionNo : "—"} · Line {lineNo}
                {attemptNo > 1 && <span className="ml-1 text-amber-500">attempt {attemptNo}</span>}
              </span>
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

            <LineViewer
              label="Expected line"
              resetKey={`${currentQid ?? ""}:${currentLid ?? ""}`}
              sticky
            >
              {expectedAscii ? (
                <PresenterMath ascii={expectedAscii} keyBase="reason-expected" color="currentColor" />
              ) : (
                <span className="italic text-muted-foreground">no answer key</span>
              )}
            </LineViewer>

            <LineViewer
              label="Student line (live)"
              resetKey={`${currentQid ?? ""}:${currentLid ?? ""}`}
              right={
                activeRow !== null ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">row {activeRow}</span>
                ) : null
              }
            >
              {studentAscii.trim() ? (
                <PresenterMath ascii={toDisplaySafe(studentAscii)} keyBase="reason-student" color="currentColor" />
              ) : (
                <span className="italic text-muted-foreground">nothing written yet</span>
              )}
            </LineViewer>


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
                {shownCorrect === true ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {shownDiagnosis?.label ?? "Equivalent"}</>
                ) : shownCorrect === false ? (
                  <><XCircle className="h-4 w-4 text-red-500" /> {shownDiagnosis?.label ?? "Not equivalent"}</>
                ) : studentAscii.trim() ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> <span className="text-muted-foreground">Evaluating…</span></>
                ) : (
                  <span className="text-muted-foreground">Nothing written</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {shownDiagnosis?.detail ??
                  (shownVerdict
                    ? verdictLabel(shownVerdict)
                    : studentAscii.trim()
                      ? "The reasoning engine is evaluating this line."
                      : "No line content to evaluate yet.")}
              </div>
              {shownDiagnosis?.code && (
                <div className="font-mono text-[10px] text-muted-foreground">{shownDiagnosis.code}</div>
              )}
              <div className="text-xs tabular-nums">
                Awarded <span className="font-semibold">{awardedMarks}</span>
                <span className="text-muted-foreground">/{lineMarks}</span>
                {awardedMarks > 0 && <span className="ml-1 text-emerald-500">permanent</span>}
              </div>
            </div>

            {allowedTokens && allowedTokens.length > 0 && (
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Floating numbers for this line
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {allowedTokens.map((t, i) => (
                    <span key={`${t}-${i}`} className="rounded border border-border px-2 py-0.5 text-[13px]">
                      <PresenterMath ascii={toDisplaySafe(t)} keyBase={`reason-chip-${i}`} color="currentColor" />
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card/40 p-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Student-introduced terms
              </div>
              {studentAddedTerms.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {studentAddedTerms.map((t, i) => (
                    <span key={`${t}-${i}`} className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[13px] text-amber-600 dark:text-amber-400">
                      <PresenterMath ascii={toDisplaySafe(t)} keyBase={`reason-add-${i}`} color="currentColor" />
                    </span>
                  ))}
                </div>

              ) : (
                <div className="text-[11px] text-muted-foreground">
                  {studentAscii.trim() ? "Only the items supplied for this line were used." : "—"}
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default TeacherReasoningPanel;
