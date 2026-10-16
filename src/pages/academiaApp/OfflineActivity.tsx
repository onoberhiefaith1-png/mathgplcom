import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MonitorPlay } from "lucide-react";
import TutorGuide from "@/components/assistant/TutorGuide";
import PresentationView from "@/components/smartboard/PresentationView";
import ImaginePlayPage from "@/pages/imagine/ImaginePlayPage";
import QuestionVideoPane, { type LineContext } from "@/components/smartboard/QuestionVideoPane";
import type { LocalAttempt, PackActivity } from "@/lib/offline/academiaStore";
import { getRun, saveRun } from "@/lib/offline/academiaStore";
import { offlineMediaUrl } from "@/lib/offline/prepareOffline";
import { videoReady } from "@/lib/courses/questionVideo";

type Award = { lineId: string; studentAscii: string; marks: number; at: string };
type SavedRun = { awards: Award[]; startedAt: string };

export default function OfflineActivity({ activity, sessionId, mode, onFinish, onBack, onContinue, playPosition, onMathInput, onMarks }: {
  activity: PackActivity;
  sessionId: string;
  mode: "practice" | "play";
  onFinish: (attempt: LocalAttempt) => void;
  onBack: () => void;
  /** Step to the next activity in the same mode. */
  onContinue?: () => void;
  playPosition?: { index: number; total: number };
  /** First mathematical input on the board/Game: starts or resumes the Session attempt. */
  onMathInput?: () => void;
  /** A line was marked correct (marks), for the Session attempt. */
  onMarks?: (e: { lineId: string; marks: number }) => void;
}) {
  const inputRef = useRef(onMathInput); inputRef.current = onMathInput;
  const marksRef = useRef(onMarks); marksRef.current = onMarks;
  const inputSeen = useRef(false);
  // Only real maths counts: a typed character or a tapped keypad token, never opening or watching.
  const noteInput = (e: React.SyntheticEvent) => {
    if (inputSeen.current) return;
    if (e.type === "keydown") {
      const k = (e as React.KeyboardEvent).key;
      if (k.length !== 1 || !/[0-9a-zA-Z+\-*/=^().√π]/.test(k)) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-no-math-input]")) return;
    } else {
      const btn = (e.target as HTMLElement).closest("button");
      const label = (btn?.textContent ?? "").trim();
      if (!btn || btn.getAttribute("aria-label") || label.length === 0 || label.length > 3) return;
    }
    inputSeen.current = true;
    inputRef.current?.();
  };
  const capture = { onKeyDownCapture: noteInput, onClickCapture: noteInput };
  const bundle = activity.game;
  const board = activity.board ?? bundle?.board ?? null;
  const [awards, setAwards] = useState<Award[]>([]);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [restored, setRestored] = useState(false);
  const [lineContext, setLineContext] = useState<LineContext>({ questionId: null, lineId: null, index: 0, total: 0, completed: false });
  const [videoOpen, setVideoOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const finishedRef = useRef(false);
  const video = mode === "practice" ? activity.practiceVideo ?? null : activity.playVideo ?? null;

  useEffect(() => {
    let active = true;
    void getRun<SavedRun>(activity.id, mode).then((saved) => {
      if (!active || !saved) return;
      setAwards(saved.awards ?? []);
      setStartedAt(saved.startedAt ?? new Date().toISOString());
    }).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [activity.id, mode]);

  useEffect(() => {
    if (!restored) return;
    void saveRun(activity.id, mode, { awards, startedAt } satisfies SavedRun);
  }, [activity.id, awards, mode, restored, startedAt]);

  const score = awards.reduce((sum, award) => sum + award.marks, 0);
  const maxScore = board?.totalMarks ?? 0;
  const onLineAward = useCallback((award: { lineId: string; studentAscii: string; marks: number }) => {
    if (!inputSeen.current) { inputSeen.current = true; inputRef.current?.(); }
    marksRef.current?.({ lineId: award.lineId, marks: award.marks });
    setAwards((current) => current.some((entry) => entry.lineId === award.lineId)
      ? current
      : [...current, { ...award, at: new Date().toISOString() }]);
  }, []);

  useEffect(() => {
    if (!board || !restored || finishedRef.current || maxScore <= 0 || score < maxScore) return;
    finishedRef.current = true;
    onFinish({
      id: crypto.randomUUID(), activityId: activity.id, sessionId, mode, score, maxScore,
      at: new Date().toISOString(), synced: false,
      lines: board.lineIds.map((lineId) => {
        const award = awards.find((entry) => entry.lineId === lineId);
        return { written: award?.studentAscii ?? "", correct: !!award, marks: award?.marks ?? 0, seconds: 0 };
      }),
      seconds: Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 1000)),
    });
  }, [activity.id, awards, board, maxScore, mode, onFinish, restored, score, sessionId, startedAt]);

  const videoConfig = useMemo(() => video ? { ...video, videoPath: video.videoPath ? offlineMediaUrl(video.videoPath) : video.videoPath } : null, [video]);
  const videoLines = useMemo(() => (board?.lineIds ?? []).map((lineId, index) => ({ lineId, label: `Line ${index + 1}`, preview: board?.lineNotes?.[index] ?? null, note: board?.lineNotes?.[index] ?? null })), [board]);
  const guideLines = useMemo(() => (activity.lines ?? []).map((line, index) => ({
    equation: String((line as { equation?: string }).equation ?? ""),
    fillers: (line as { fillers?: string[] }).fillers,
    note: board?.lineNotes?.[index] ?? null,
  })), [activity.lines, board]);
  if (mode === "play" && bundle) {
    return (
      <div className="fixed inset-0 z-[100] bg-background" {...capture}>
        <ImaginePlayPage
          key={`${activity.id}-play`}
          offline={{
            activityId: activity.id, game: bundle.game, board: bundle.board,
            startingLives: bundle.startingLives,
            assetUrls: Object.fromEntries(Object.entries(bundle.assetUrls).map(([id, url]) => [id, offlineMediaUrl(url)])),
            playVideo: activity.playVideo ?? null, onLineAward, onExit: onBack,
            sessionPlay: playPosition ? { ...playPosition, onContinue } : undefined,
          }}
        />
      </div>
    );
  }
  if (!board) {
    return <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">Connect once to update this activity for full offline Practice and Play.</div>;
  }

  const smartboard = (
    <PresentationView
      key={`${activity.id}-${mode}`}
      role="student"
      source={board.boardSource}
      notebookId={board.notebookId}
      assessmentId={board.assessmentId}
      boardStudentId={`offline:${activity.id}`}
      boardQuestionId={board.boardQuestionId}
      workspace="assignment"
      gameId={bundle?.game.id}
      testMode
      localMarking
      timerEnabled
      onLineAward={onLineAward}
      onLineContext={videoReady(videoConfig) || guideOpen ? setLineContext : undefined}
      permanentAchievementColor="hsl(25 60% 35%)"
      currentAttemptColor="hsl(210 90% 52%)"
      touchSession={{
        questionIndex: 0, questionCount: 1, score, totalScore: maxScore,
        onQuestionChange: () => undefined, onBack, backLabel: "Back to Session",
        videoControl: videoReady(videoConfig) ? (
          <button type="button" onClick={() => setVideoOpen((open) => !open)} aria-label={videoOpen ? "Show Smartboard" : "Show video"} className="grid h-8 w-8 place-items-center rounded-md">
            <MonitorPlay className="h-4 w-4" />
          </button>
        ) : null,
        fullscreen: true, onFullscreenChange: () => undefined,
      }}
    />
  );

  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-background" {...capture}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
        <button type="button" onClick={onBack} aria-label="Back to Session" className="grid h-9 w-9 place-items-center rounded-md"><ArrowLeft className="h-5 w-5" /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activity.title}</span>
        {mode === "practice" && onContinue ? (
          <button type="button" onClick={onContinue} aria-label="Next practice" className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold">Next <ArrowRight className="h-3 w-3" /></button>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {guideOpen ? (
          <div className="grid h-full min-h-0 grid-rows-[45%_1fr] md:grid-cols-[minmax(18rem,38%)_1fr] md:grid-rows-1">
            <TutorGuide lines={guideLines} currentLine={lineContext.index} />
            <div className="min-h-0">{smartboard}</div>
          </div>
        ) : videoReady(videoConfig) && videoConfig && videoOpen ? (
          <div className="grid h-full min-h-0 md:grid-cols-[minmax(18rem,38%)_1fr]">
            <QuestionVideoPane config={videoConfig} lines={videoLines} lineContext={lineContext} />
            <div className="min-h-0">{smartboard}</div>
          </div>
        ) : smartboard}
      </div>
    </div>
  );
}