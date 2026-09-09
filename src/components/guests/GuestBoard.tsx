// Guest Link — the solving surface for ONE original question set.
//
// The same Smartboard, the same marking engine and the SAME three-position
// video layout students get (Smartboard only · Split view · Video only). The
// video appears only when the teacher attached one to that question; nothing is
// duplicated for a guest — the original video is streamed by reference.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import PresentationView from "@/components/smartboard/PresentationView";
import ThreeViewFrame, { useBoardVideoView } from "@/components/smartboard/ThreeViewFrame";
import BoardViewSwitcher from "@/components/student/BoardViewSwitcher";
import type { LineContext } from "@/components/smartboard/QuestionVideoPane";
import { buildAssessmentBoardSource, type AssessmentLike } from "@/lib/assessments/assessmentBoardSource";
import { videoLinesFromQuestion, videoReady, type QuestionVideoConfig } from "@/lib/courses/questionVideo";
import { fetchGuestAttempts, fetchGuestVideo, sendGuestHeartbeat } from "@/lib/guests/guestApi";
import { guestLinkDisplayName, guestLinkName } from "@/lib/guests/guestSession";

interface Props {
  code: string;
  token: string;
  assessment: AssessmentLike;
  /** Exercise Card id — only a course exercise can carry teaching videos. */
  blockId?: string | null;
  backLabel: string;
  onBack: () => void;
}

const GuestBoard = ({ code, token, assessment, blockId = null, backLabel, onBack }: Props) => {
  const questions = useMemo(() => assessment.questions ?? [], [assessment]);
  const [questionId, setQuestionId] = useState<string | null>(questions[0]?.id ?? null);
  const qIndex = Math.max(0, questions.findIndex((q) => q.id === questionId));
  const [video, setVideo] = useState<QuestionVideoConfig | null>(null);
  const [videoView, setVideoView] = useBoardVideoView();
  // Phone/tablet guest session: compact header + in-app immersive mode (iOS
  // Safari does not grant real element fullscreen).
  const bp = useBreakpoint();
  const mobile = bp === "phone" || bp === "tablet";
  const [immersive, setImmersive] = useState(false);
  const [score, setScore] = useState<{ score: number; total: number } | null>(null);
  const [lineCtx, setLineCtx] = useState<LineContext>({
    questionId: null, lineId: null, index: 0, total: 0, completed: false,
  });

  useEffect(() => {
    setQuestionId(questions[0]?.id ?? null);
  }, [questions]);

  // The ORIGINAL teaching video for this question, if the teacher added one.
  useEffect(() => {
    if (!blockId || !questionId) { setVideo(null); return; }
    let alive = true;
    void fetchGuestVideo(code, blockId, questionId)
      .then((cfg) => { if (alive) setVideo(cfg); })
      .catch(() => { if (alive) setVideo(null); });
    return () => { alive = false; };
  }, [code, blockId, questionId]);

  // The guest's own running total — read from their own attempt, never a
  // student's progress.
  const refreshScore = useCallback(async () => {
    const rows = await fetchGuestAttempts(code, token);
    const mine = rows.filter((r) => r.assessment_id === assessment.id);
    if (mine.length === 0) return;
    setScore({
      score: mine.reduce((s, r) => s + (Number(r.score) || 0), 0),
      total: mine.reduce((s, r) => s + (Number(r.total_marks) || 0), 0),
    });
  }, [code, token, assessment.id]);

  // Guest solving clock for the CURRENT question. It exists only to contribute
  // a valid time to that question's Overall Best Time benchmark — it is never
  // student progress and never leaves the guest layer.
  const startedAtRef = useRef<number>(Date.now());
  useEffect(() => { startedAtRef.current = Date.now(); }, [questionId, assessment.id]);

  const completed = !!score && score.total > 0 && score.score >= score.total;

  // Heartbeat: lets the teacher see this guest working, live.
  useEffect(() => {
    let alive = true;
    const beat = () => {
      void sendGuestHeartbeat(code, {
        token,
        name: guestLinkName(),
        assessmentId: assessment.id,
        questionId,
        elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
        completed,
      });
      void refreshScore();
    };
    beat();
    const id = window.setInterval(() => { if (alive) beat(); }, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, [code, token, assessment.id, questionId, completed, refreshScore]);


  const boardSource = useMemo(() => {
    const scoped = questionId ? questions.filter((q) => q.id === questionId) : questions;
    return buildAssessmentBoardSource({
      ...assessment,
      questions: (scoped.length ? scoped : questions) as never,
    });
  }, [assessment, questions, questionId]);

  const videoLines = useMemo(() => {
    const q = questions.find((x) => x.id === questionId);
    return videoLinesFromQuestion(q?.lines as Parameters<typeof videoLinesFromQuestion>[0]);
  }, [questions, questionId]);

  const board = (
    <PresentationView
      key={`${assessment.id}:${questionId ?? "all"}:${token}`}
      role="student"
      source={boardSource}
      assessmentId={assessment.id}
      classId={null}
      workspace="assignment"
      boardStudentId={token}
      boardQuestionId={questionId}
      guestSlug={code}
      participantKey={token}
      guestName={guestLinkName()}
      onLineContext={videoReady(video) ? setLineCtx : undefined}
      touchSession={mobile ? {
        questionIndex: qIndex,
        questionCount: questions.length,
        onQuestionChange: (index) => setQuestionId(questions[index]?.id ?? questionId),
        score: score?.score ?? 0,
        totalScore: score?.total ?? 0,
        onBack,
        backLabel,
        videoControl: videoReady(video) ? (
          <button
            type="button"
            onClick={() => setVideoView(videoView === "video" ? "board" : "video")}
            aria-label={videoView === "video" ? "Show Smartboard" : "Show video"}
            title={videoView === "video" ? "Smartboard" : "Video"}
            className="grid h-8 w-8 place-items-center rounded-md"
          >
            <MonitorPlay className="h-4 w-4" />
          </button>
        ) : null,
        fullscreen: immersive,
        onFullscreenChange: setImmersive,
      } : undefined}
    />
  );

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      {/* Desktop keeps its established session header. Phone/tablet controls
          live inside PresentationView so there is exactly one compact row. */}
      {!mobile && (
      <div
        className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 text-xs"
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md px-2 font-medium hover:bg-muted"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </button>
          <span className="truncate font-semibold">{assessment.title}</span>

          {questions.length > 1 && (
            <span className="flex flex-wrap items-center gap-1">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuestionId(q.id)}
                  className={`min-h-[32px] rounded-full px-2.5 text-[11px] font-semibold transition ${
                    q.id === questionId
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Q{i + 1}
                </button>
              ))}
            </span>
          )}

        </div>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {score && (
            <span className="tabular-nums text-muted-foreground">
              {score.score}/{score.total} marks
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5">{guestLinkDisplayName()}</span>
          {videoReady(video) && <BoardViewSwitcher value={videoView} onChange={setVideoView} />}
        </span>
      </div>
      )}

      <div className="relative min-h-0 flex-1">
        {videoReady(video) && video ? (
          <ThreeViewFrame
            config={video}
            lines={videoLines}
            lineContext={lineCtx}
            view={videoView}
            board={board}
          />
        ) : (
          board
        )}
      </div>
    </div>
  );
};

export default GuestBoard;
