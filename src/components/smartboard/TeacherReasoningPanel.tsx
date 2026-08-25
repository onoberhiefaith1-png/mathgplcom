// Teacher Mathematical Reasoning Panel — a narrow (~20%) debugging surface
// that shows, live, how the grader evaluates the CURRENT line the student is
// working on. It never rewrites student ink and never persists progress
// (all grading here is a dry run).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X as XIcon, CheckCircle2, XCircle, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import { localLiveChannel, subscribeLocalLive } from "@/lib/smartboard/localLiveBridge";
import { usePolling } from "@/lib/stability/usePolling";

import { collapseNestedBoxes, structureHash, type Row } from "@/lib/smartboard/mathTree";
import MathTreeRender from "./MathTreeRender";
import { PresenterMath, PRESENTER_INK, toDisplaySafe } from "./PresenterMath";
import { renderMathInline } from "@/lib/notebook/mathRender";
import type { TableValidation } from "@/lib/smartboard/tableActivity";

/** Cell-aware table viewer. Values keep their coordinates: a value is only
 *  ever shown (and only ever counted) in the cell it belongs to.
 *  `side = "expected"` draws the teacher's grid, `"student"` the answers. */
const TableGridViewer = ({
  table,
  side,
}: {
  table: TableValidation;
  side: "expected" | "student";
}) => {
  const cells = new Map<string, TableValidation["tracks"][number]["cells"][number]>();
  for (const t of table.tracks) for (const c of t.cells) cells.set(c.key, c);
  const activeKeys = new Set((table.activeTrack?.cells ?? []).map((c) => c.key));
  const headers = table.headers ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[14px]">
        {headers.some((h) => String(h ?? "").trim()) && (
          <thead>
            <tr>
              {headers.map((h, c) => (
                <th key={`th-${c}`} className="border border-border px-2 py-1 text-center font-semibold">
                  {String(h ?? "").trim() ? renderMathInline(String(h), `tgv-h-${side}-${c}`) : "\u00A0"}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: table.rows }, (_, r) => (
            <tr key={`tr-${r}`}>
              {Array.from({ length: table.cols }, (_, c) => {
                const key = `${r}:${c}`;
                const cell = cells.get(key);
                const inActive = activeKeys.has(key);
                const value = side === "expected"
                  ? cell?.expected ?? ""
                  : cell?.status === "retained" ? cell.expected : cell?.given ?? "";
                const tone =
                  side === "student" && cell
                    ? cell.status === "correct"
                      ? "text-emerald-500"
                      : cell.status === "incorrect"
                        ? "text-destructive"
                        : cell.status === "retained"
                          ? "text-muted-foreground"
                          : ""
                    : "";
                return (
                  <td
                    key={key}
                    className={`border border-border px-2 py-1 text-center tabular-nums ${tone} ${
                      inActive ? "bg-amber-500/10" : ""
                    }`}
                    style={{ minWidth: 52 }}
                    title={key}
                  >
                    {String(value ?? "").trim()
                      ? renderMathInline(String(value), `tgv-${side}-${key}`)
                      : "\u00A0"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {side === "student" && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {table.activeTrack
            ? `${table.activeTrack.label} — ${table.activeTrack.cells.filter((c) => c.status === "correct").length}/${
                table.activeTrack.cells.filter((c) => c.status !== "retained").length
              } cells correct`
            : "no active row"}
        </div>
      )}
    </div>
  );
};

type KeyLine = { questionId: string; lineId: string; tokens: string[]; equationAscii?: string };

type QuestionShape = { id: string; lines: Array<{ lineId: string; marks?: number }> };
type LivePayload = {
  ts: number;
  questionId: string | null;
  activeLineIdx: number;
  lineIds: Array<string | null>;
  rowsAscii: Record<number, string>;
  linesAscii: Record<string, string>;
  /** The math OBJECT itself — the Student Line mirrors this verbatim. */
  rowsTree?: Record<number, Row>;
  linesTree?: Record<string, Row>;
  floatingTokens?: Record<string, string[]>;
  /** Reasoning-engine view of the ONE active line. */
  activeRow?: number | null;
  attempt?: number;
  introducedTerms?: string[];
  /** A TABLE STAYS A TABLE — the hidden Smart Table validation snapshot. When
   *  present the expected / student lines are drawn as grids, never as text. */
  table?: TableValidation | null;
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
        sticky ? "sticky top-0 z-10 shadow-xs" : ""
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
  /** The board is running in THIS page (Floating Number test sitting): also
   *  listen on the in-page bridge, because realtime broadcasts never come
   *  back to their own tab. */
  localLive?: boolean;
}

const TeacherReasoningPanel = ({
  assessmentId,
  studentId,
  questionId: scopeQuestionId = null,
  studentName,
  onClose,
  fullscreen = false,
  onToggleFullscreen,
  localLive = false,
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
  usePolling("evaluation-freshness", () => forceTick((n) => n + 1), 1000, { immediate: false });


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

  usePolling("evaluation-progress", () => refreshProgress(), 4000);


  // ── Durable fallback: the persisted board state row. Used whenever no
  // broadcast has arrived recently (idle / offline student). ───────────────
  const loadFallback = useCallback(async () => {
    // Per-question board first — that is where students actually write. The
    // legacy shared row is only read when it belongs to THIS question.
    type FallbackRow = {
      state_json: unknown;
      question_id: string | null;
      active_line_idx: number | null;
      updated_at: string;
    };
    let row: FallbackRow | null = null;

    if (scopeQuestionId) {
      const { data } = await supabase
        .from("assessment_question_board_state")
        .select("state_json, question_id, active_line_idx, updated_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .eq("question_id", scopeQuestionId)
        .maybeSingle();
      row = (data as FallbackRow | null) ?? null;
    }

    if (!row) {
      const { data } = await supabase
        .from("assessment_board_state")
        .select("state_json, question_id, active_line_idx, updated_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      const legacy = (data as FallbackRow | null) ?? null;
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
    const rowsTree: Record<number, Row> = {};
    for (const [k, v] of Object.entries(sj.freeLines ?? {})) {
      const n = Number(k);
      if (!Number.isFinite(n)) continue;
      if (Array.isArray(v) && v.length > 0) {
        // The persisted row IS the math object — keep it as-is for display.
        rowsTree[n] = v as unknown as Row;
        try { rowsAscii[n] = rowToAscii(v as never); } catch { /* ignore */ }
      }
    }
    const cursorRow = Math.floor(sj.sensor?.line ?? -1);
    const cursorAscii = rowsAscii[cursorRow] ?? "";
    const cursorTree = rowsTree[cursorRow];
    setFallback({
      ts: new Date(row.updated_at).getTime(),
      questionId,
      activeLineIdx,
      lineIds: [],
      rowsAscii,
      linesAscii: cursorAscii ? { __cursor: cursorAscii } : {},
      rowsTree,
      linesTree: cursorTree ? { __cursor: cursorTree } : {},
    });
    setFallbackAt(new Date(row.updated_at).getTime());
  }, [assessmentId, studentId, scopeQuestionId]);


  usePolling(
    "evaluation-fallback",
    () => {
      // Only poll while the live feed is stale.
      if (Date.now() - liveAtRef.current > 5000) return loadFallback();
    },
    3000,
  );


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

  // Same-page feed (test sitting): identical payloads, delivered in-process.
  useEffect(() => {
    if (!localLive) return;
    const chan = localLiveChannel(assessmentId, studentId);
    const offBoard = subscribeLocalLive(chan, "board", (raw) => {
      const p = raw as LivePayload | null;
      if (!p) return;
      liveAtRef.current = Date.now();
      setLive(p);
    });
    const offCheck = subscribeLocalLive(chan, "check", (raw) => {
      const p = raw as CheckPayload | null;
      if (!p) return;
      setLastCheck(p);
      void refreshProgress();
    });
    return () => { offBoard(); offCheck(); };
  }, [localLive, assessmentId, studentId, refreshProgress]);

  const isLive = Date.now() - liveAtRef.current < 6000 && !!live;
  const feed = isLive ? live : (live ?? fallback);
  const usingFallback = !isLive && !!fallback && !live;


  // ── The CURRENT line — always follows the student's cursor. ──────────────
  const currentQid = feed?.questionId ?? null;
  const currentQ = useMemo(() => questions.find((q) => q.id === currentQid) ?? null, [questions, currentQid]);
  const questionNo = useMemo(() => questions.findIndex((q) => q.id === currentQid) + 1, [questions, currentQid]);
  const activeIdx = Math.max(0, Math.floor(feed?.activeLineIdx ?? 0));
  /** TAG — the active floating number's OWN identifier, as broadcast by the
   *  board (`T3` inside a Smart Table, the lesson step number outside). Never
   *  recomputed here: a table row must not be tagged with a lesson number. */
  const lineNo = (feed as { activeTag?: string } | null)?.activeTag
    ?? String(activeIdx + 1);


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

  /** The student's live math OBJECT for this line. Rendered directly by the
   *  Smartboard's own renderer — never rebuilt from text. */
  const studentTree = useMemo<Row | null>(() => {
    if (!feed) return null;
    const t =
      (currentLid ? feed.linesTree?.[currentLid] : undefined) ??
      feed.linesTree?.__cursor ??
      (feed.activeRow != null ? feed.rowsTree?.[feed.activeRow] : undefined);
    if (!Array.isArray(t) || t.length === 0) return null;
    // Defensive: a legacy board may still carry box-inside-box cells.
    return collapseNestedBoxes(t);
  }, [feed, currentLid]);

  const studentObjectId = useMemo(
    () => (studentTree ? structureHash(studentTree) : null),
    [studentTree],
  );

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
            <span>🧠</span> Evaluation
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{studentName}</div>
        </div>
        <div className="flex items-center gap-1">
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={fullscreen ? "Exit evaluation full screen" : "Evaluation full screen"}
              title={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close evaluation panel"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
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
              {feed.table ? (
                <TableGridViewer table={feed.table} side="expected" />
              ) : expectedAscii ? (
                <PresenterMath ascii={expectedAscii} keyBase="reason-expected" color="currentColor" />
              ) : (
                <span className="italic text-muted-foreground">no answer key</span>
              )}
            </LineViewer>

            <LineViewer
              label="Student line (live)"
              resetKey={`${currentQid ?? ""}:${currentLid ?? ""}`}
              right={
                <span className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                  {studentObjectId && <span title="Math object id">#{studentObjectId}</span>}
                  {activeRow !== null && <span>row {activeRow}</span>}
                </span>
              }
            >
              {feed.table ? (
                <TableGridViewer table={feed.table} side="student" />
              ) : studentTree ? (
                // MIRROR: the exact object on the student's Smartboard.
                <span style={{ color: "currentColor" }}>
                  <MathTreeRender
                    root={studentTree}
                    readOnly
                    cursor={{ path: [-1], index: -1 }}
                    onCursorChange={() => {}}
                    caretColor={PRESENTER_INK}
                  />
                </span>
              ) : studentAscii.trim() ? (
                // Legacy client with no object in the payload.
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
                      ? "The evaluation engine is evaluating this line."
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
