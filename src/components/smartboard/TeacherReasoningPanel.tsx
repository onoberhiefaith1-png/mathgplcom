// Teacher Mathematical Reasoning Panel — debugging surface that shows, live,
// exactly how the grader is evaluating each of the selected student's lines
// against the answer key. Never rewrites student ink; never persists progress.

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
    case "not_in_floating_set": return "Uses tokens outside available floating numbers";
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
  const [selectedQid, setSelectedQid] = useState<string | null>(null);
  const [selectedLid, setSelectedLid] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);

  // Load assessment shape + answer key + student progress.
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
      const qs = ((a?.questions as unknown) as QuestionShape[]) ?? [];
      setQuestions(qs);
      setKeyLines(((k?.lines as unknown) as KeyLine[]) ?? []);
      setProgress(p ? { solved_lines: (p.solved_lines as Record<string, number>) ?? {}, score: Number(p.score ?? 0) } : { solved_lines: {}, score: 0 });
      if (!selectedQid && qs[0]) {
        setSelectedQid(qs[0].id);
        setSelectedLid(qs[0].lines?.[0]?.lineId ?? null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, studentId]);

  // Live progress updates for the awarded-marks column.
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

  // Subscribe to the student's live board broadcast.
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

  const selectedQ = useMemo(() => questions.find((q) => q.id === selectedQid) ?? null, [questions, selectedQid]);
  const expectedAscii = useMemo(() => {
    const k = keyLines.find((x) => x.questionId === selectedQid && x.lineId === selectedLid);
    return (k?.tokens ?? []).join(" ").trim();
  }, [keyLines, selectedQid, selectedLid]);
  const studentAscii = useMemo(() => {
    if (!selectedLid || !live) return "";
    return live.linesAscii?.[selectedLid] ?? "";
  }, [live, selectedLid]);
  const awardedMarks = useMemo(() => {
    if (!selectedQid || !selectedLid) return 0;
    return Number(progress?.solved_lines?.[`${selectedQid}:${selectedLid}`] ?? 0);
  }, [progress, selectedQid, selectedLid]);
  const lineMarks = useMemo(() => {
    const l = selectedQ?.lines?.find((x) => x.lineId === selectedLid);
    return Number(l?.marks ?? 0);
  }, [selectedQ, selectedLid]);

  // Dry-run grade whenever the student's line changes.
  const debounceRef = useRef<number | null>(null);
  const runDryGrade = useCallback(async () => {
    if (!selectedQid || !selectedLid || !studentAscii || studentAscii.trim().length === 0) {
      setVerdict(null);
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-line", {
        body: {
          assessmentId,
          questionId: selectedQid,
          lineId: selectedLid,
          studentAscii,
          mode: "manual",
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
  }, [assessmentId, selectedQid, selectedLid, studentAscii]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void runDryGrade(); }, 300);
  }, [runDryGrade]);

  return (
    <div className="flex h-full flex-col border-l border-border bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg">🧠</span>
          <div>
            <div className="text-sm font-semibold">Mathematical Reasoning</div>
            <div className="text-xs text-muted-foreground">Live debug view · {studentName}</div>
          </div>
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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: question / line picker */}
        <aside className="w-56 flex-none overflow-y-auto border-r border-border bg-muted/20">
          {questions.map((q, qi) => (
            <div key={q.id} className="border-b border-border/50 py-2">
              <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Question {qi + 1}
              </div>
              {q.lines.map((l, li) => {
                const slot = `${q.id}:${l.lineId}`;
                const awarded = Number(progress?.solved_lines?.[slot] ?? 0);
                const isActive = selectedQid === q.id && selectedLid === l.lineId;
                const isLive = live?.questionId === q.id && live?.lineIds?.[li] === l.lineId;
                return (
                  <button
                    key={l.lineId}
                    type="button"
                    onClick={() => { setSelectedQid(q.id); setSelectedLid(l.lineId); }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${isActive ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      Line {li + 1}
                      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-label="live" />}
                    </span>
                    <span className={`tabular-nums ${awarded > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {awarded}/{Number(l.marks ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Right: reasoning detail */}
        <section className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4">
          {!selectedQid || !selectedLid ? (
            <div className="text-sm text-muted-foreground">Pick a line to inspect.</div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {(() => {
                  const qi = questions.findIndex((q) => q.id === selectedQid);
                  const li = selectedQ?.lines.findIndex((l) => l.lineId === selectedLid) ?? -1;
                  return `Question ${qi + 1} · Line ${li + 1}`;
                })()}
              </div>

              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Expected Line</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-base text-foreground">
                  {expectedAscii || <span className="text-muted-foreground italic">no answer key</span>}
                </pre>
              </div>

              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Student Line (live)</div>
                  {live && <div className="text-[10px] text-muted-foreground tabular-nums">t+{Math.max(0, Math.floor((Date.now() - live.ts) / 1000))}s</div>}
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-base text-foreground">
                  {studentAscii || <span className="text-muted-foreground italic">nothing written yet</span>}
                </pre>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Equivalent?</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    {checking ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> checking…</>
                    ) : verdict?.correct ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> YES</>
                    ) : verdict ? (
                      <><XCircle className="h-4 w-4 text-red-500" /> NO</>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reason</div>
                  <div className="mt-1 text-xs">{verdict ? verdictLabel(verdict.verdict) : <span className="text-muted-foreground">—</span>}</div>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Awarded</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {awardedMarks}<span className="text-muted-foreground">/{lineMarks}</span>
                  </div>
                </div>
              </div>

              {verdict?.teacherAscii && verdict.teacherAscii !== expectedAscii && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  Grader used a normalised expected: <span className="font-mono">{verdict.teacherAscii}</span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeacherReasoningPanel;
