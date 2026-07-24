// Teacher Mathematical Reasoning Panel — a narrow (~20%) debugging surface
// that shows, live, how the grader evaluates the CURRENT line the student is
// working on. It never rewrites student ink and never persists progress
// (all grading here is a dry run).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X as XIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

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
type Verdict = {
  correct: boolean;
  verdict: string;
  marks: number;
  teacherAscii?: string;
};

const verdictLabel = (v: string): string => {
  switch (v) {
    case "equal": return "Mathematically equivalent";
    case "not_equal": return "Not mathematically equivalent";
    case "not_in_floating_set": return "Uses tokens outside the floating numbers given for this line";
    case "parse_error": return "Could not parse the student's expression";
    default: return v || "—";
  }
};

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
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);

  // Assessment shape + answer key + current progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: a }, { data: k }, { data: p }] = await Promise.all([
        supabase.from("assessments").select("questions").eq("id", assessmentId).maybeSingle(),
        supabase.from("assessment_answer_keys").select("lines").eq("assessment_id", assessmentId).maybeSingle(),
        supabase
          .from("assessment_progress")
          .select("solved_lines, score")
          .eq("assessment_id", assessmentId)
          .eq("student_id", studentId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setQuestions(((a?.questions as unknown) as QuestionShape[]) ?? []);
      setKeyLines(((k?.lines as unknown) as KeyLine[]) ?? []);
      setProgress(
        p
          ? { solved_lines: (p.solved_lines as Record<string, number>) ?? {}, score: Number(p.score ?? 0) }
          : { solved_lines: {}, score: 0 },
      );
    })();
    return () => { cancelled = true; };
  }, [assessmentId, studentId]);

  // Live progress updates for the awarded-marks readout.
  useEffect(() => {
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-progress-panel-${assessmentId}-${studentId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress", filter: `assessment_id=eq.${assessmentId}` },
          (payload) => {
            const row = payload.new as { student_id?: string; solved_lines?: Record<string, number>; score?: number } | null;
            if (!row || row.student_id !== studentId) return;
            setProgress({ solved_lines: row.solved_lines ?? {}, score: Number(row.score ?? 0) });
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentId, studentId]);

  // Live board broadcast from the student's Smartboard.
  useEffect(() => {
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-live-${assessmentId}-${studentId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "board" }, (msg) => {
          const p = (msg as { payload?: LivePayload }).payload;
          if (p) setLive(p);
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentId, studentId]);

  // ── The CURRENT line — always follows the student's cursor. ──────────────
  const currentQid = live?.questionId ?? null;
  const currentLid = useMemo(() => {
    if (!live) return null;
    const idx = Math.max(0, Math.floor(live.activeLineIdx ?? 0));
    return live.lineIds?.[idx] ?? null;
  }, [live]);

  const currentQ = useMemo(() => questions.find((q) => q.id === currentQid) ?? null, [questions, currentQid]);
  const questionNo = useMemo(() => questions.findIndex((q) => q.id === currentQid) + 1, [questions, currentQid]);
  const lineNo = (live?.activeLineIdx ?? 0) + 1;

  const expectedAscii = useMemo(() => {
    const k = keyLines.find((x) => x.questionId === currentQid && x.lineId === currentLid);
    return (k?.tokens ?? []).join(" ").trim();
  }, [keyLines, currentQid, currentLid]);

  const studentAscii = useMemo(() => {
    if (!currentLid || !live) return "";
    return live.linesAscii?.[currentLid] ?? "";
  }, [live, currentLid]);

  const allowedTokens = useMemo(() => {
    if (!currentLid || !live?.floatingTokens) return undefined;
    return live.floatingTokens[currentLid];
  }, [live, currentLid]);

  const awardedMarks = useMemo(() => {
    if (!currentQid || !currentLid) return 0;
    return Number(progress?.solved_lines?.[`${currentQid}:${currentLid}`] ?? 0);
  }, [progress, currentQid, currentLid]);

  const lineMarks = useMemo(() => {
    const l = currentQ?.lines?.find((x) => x.lineId === currentLid);
    return Number(l?.marks ?? 0);
  }, [currentQ, currentLid]);

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
        {!live ? (
          <div className="text-xs text-muted-foreground">
            Waiting for the student's board… the current line appears here as soon as they write.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Question {questionNo > 0 ? questionNo : "—"} · Line {lineNo}</span>
              <span className="tabular-nums">t+{Math.max(0, Math.floor((Date.now() - live.ts) / 1000))}s</span>
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
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI evaluation</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {checking ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> checking…</>
                ) : verdict?.correct ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Equivalent</>
                ) : verdict ? (
                  <><XCircle className="h-4 w-4 text-red-500" /> Not equivalent</>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {verdict ? verdictLabel(verdict.verdict) : "—"}
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherReasoningPanel;
