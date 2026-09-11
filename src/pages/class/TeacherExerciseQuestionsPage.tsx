// Teacher — the questions inside one Exercise Card.
//
// "View" opens the EXISTING Test Smartboard for that question (all current
// testing features, nothing redesigned). "Add Video" attaches the interactive
// teaching video: one continuous upload, checkpoints tied to this question's own
// mathematical lines.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, AudioLines, Brain, ClipboardList, Loader2, MonitorPlay, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import PresentationView from "@/components/smartboard/PresentationView";
import TeacherEvaluationPanel from "@/components/smartboard/TeacherEvaluationPanel";
import RecoveryBoundary from "@/components/common/RecoveryBoundary";
import { buildBoardScope, clearBoardScope } from "@/lib/smartboard/boardScope";
import ThreeViewFrame, { useBoardVideoView } from "@/components/smartboard/ThreeViewFrame";
import BoardViewSwitcher from "@/components/student/BoardViewSwitcher";
import type { LineContext } from "@/components/smartboard/QuestionVideoPane";
import QuestionVideoEditor from "@/components/coursebuilder/QuestionVideoEditor";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import {
  findCourseExerciseAssessmentRaw,
  loadExerciseCard,
  loadExerciseCardShell,
  removeExerciseLink,
  syncCourseExerciseAssessments,
  ensureExerciseQuestionTestBoard,
  type ExerciseQuestionTestBoard,
  type ExerciseCard,
  type ExerciseCardEntry,
} from "@/lib/courses/exerciseBoard";

import {
  mediaTypeOf,
  videoLinesFromQuestion,
  videoReady,
  type QuestionMediaType,
  type QuestionVideoConfig,
} from "@/lib/courses/questionVideo";
import { loadCardVideoFlags, loadQuestionVideo } from "@/lib/courses/questionVideoStore";

type RawQuestion = {
  id: string;
  lines?: {
    lineId?: string | null;
    marks?: number;
    noteOnly?: boolean;
    chips?: unknown;
    equationAscii?: unknown;
    equation?: unknown;
  }[];
};
type Loaded = { id: string; title: string; questions: RawQuestion[] };

const TeacherExerciseQuestionsPage = () => {
  const { classId, courseId, blockId } = useParams<{ classId: string; courseId: string; blockId: string }>();
  const [params, setParams] = useSearchParams();
  const activeQuestionId = params.get("q");

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [card, setCard] = useState<ExerciseCard | null>(null);
  const [withVideo, setWithVideo] = useState<Set<string>>(new Set());
  const [editorFor, setEditorFor] = useState<string | null>(null);
  const [editorConfig, setEditorConfig] = useState<QuestionVideoConfig | null>(null);
  const [editorKind, setEditorKind] = useState<QuestionMediaType>("video");
  const [activeVideo, setActiveVideo] = useState<QuestionVideoConfig | null>(null);
  const [lineCtx, setLineCtx] = useState<LineContext>({
    questionId: null, lineId: null, index: 0, total: 0, completed: false,
    lastAwardedLineId: null,
  });
  const [uid, setUid] = useState<string | null>(null);
  const [videoView, setVideoView] = useBoardVideoView();
  // The hidden test container for the open question — the existing Test
  // Smartboard needs an assessment + class to stay in test mode.
  const [testBoard, setTestBoard] = useState<ExerciseQuestionTestBoard | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [sitting, setSitting] = useState(0);
  const [evalOpen, setEvalOpen] = useState(true);
  const [evalFull, setEvalFull] = useState(false);

  const load = useCallback(async () => {
    if (!blockId) return;

    // ── Phase 1: paint the list. Links only — one round trip, no note compile.
    const shell = await loadExerciseCardShell(blockId);
    setCard(shell);
    setLoading(false);
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    void loadCardVideoFlags(blockId).then(setWithVideo).catch(() => {});

    // ── Phase 2: resolve the lesson notes (marks + the solving payload).
    const own = await loadExerciseCard(blockId);
    setCard(own);
    const fallback: Loaded = {
      id: blockId,
      title: own.title,
      questions: own.entries.flatMap((e: ExerciseCardEntry) => (e.payload ? [e.payload as RawQuestion] : [])),
    };
    setLoaded(fallback);

    if (!classId) return;
    // In a class the hidden assessment carries progress. Keeping it in step is
    // never on the critical path of opening this page.
    void (async () => {
      await syncCourseExerciseAssessments(classId).catch(() => {});
      const raw = await findCourseExerciseAssessmentRaw(classId, blockId).catch(() => null);
      if (raw && ((raw as Loaded).questions ?? []).length > 0) setLoaded(raw as Loaded);
    })();
  }, [classId, blockId]);

  useEffect(() => { void load(); }, [load]);


  // The question's video is fetched alongside the board, never gating it.
  useEffect(() => {
    if (!blockId || !activeQuestionId) { setActiveVideo(null); return; }
    let cancelled = false;

    void loadQuestionVideo(blockId, activeQuestionId)
      .catch(() => null)
      .then((cfg) => {
        if (cancelled) return;
        setActiveVideo(cfg);
      });
    return () => { cancelled = true; };
  }, [blockId, activeQuestionId]);


  const entries = card?.entries ?? [];
  const questions = loaded?.questions ?? [];
  const activeQuestion = questions.find((q) => q.id === activeQuestionId) ?? null;
  const activeLines = useMemo(
    () => videoLinesFromQuestion(((testBoard?.question as RawQuestion | undefined) ?? activeQuestion)?.lines),
    [testBoard, activeQuestion],
  );
  

  // Opening a question prepares its own hidden test sitting, exactly like
  // Floating Numbers → Test. Nothing is ever recorded against a student.
  useEffect(() => {
    if (!blockId || !activeQuestionId) { setTestBoard(null); setTestError(null); return; }
    let cancelled = false;
    setTestBoard(null);
    setTestError(null);
    setSitting(0);
    void ensureExerciseQuestionTestBoard(blockId, activeQuestionId)
      .then((next) => {
        if (cancelled) return;
        clearBoardScope(
          buildBoardScope({
            studentId: uid,
            classId: next.classId,
            workspace: "floating_test",
            assessmentId: next.assessmentId,
            questionId: activeQuestionId,
          }),
        );
        setTestBoard(next);
      })
      .catch((e) => {
        if (!cancelled) setTestError(String((e as Error)?.message ?? "Could not open the test board."));
      });
    return () => { cancelled = true; };
  }, [blockId, activeQuestionId, uid]);

  // Leaving the question discards the sitting entirely.
  useEffect(() => {
    if (!testBoard || !activeQuestionId) return;
    const scope = buildBoardScope({
      studentId: uid,
      classId: testBoard.classId,
      workspace: "floating_test",
      assessmentId: testBoard.assessmentId,
      questionId: activeQuestionId,
    });
    return () => { clearBoardScope(scope); };
  }, [testBoard, uid, activeQuestionId]);

  const restart = () => {
    if (testBoard && activeQuestionId) {
      clearBoardScope(
        buildBoardScope({
          studentId: uid,
          classId: testBoard.classId,
          workspace: "floating_test",
          assessmentId: testBoard.assessmentId,
          questionId: activeQuestionId,
        }),
      );
    }
    setSitting((n) => n + 1);
  };

  const boardSource = useMemo(() => {
    if (!testBoard) return null;
    return buildAssessmentBoardSource({
      id: testBoard.assessmentId,
      title: `${testBoard.title} — test`,
      questions: [testBoard.question] as never,
    } as never);
  }, [testBoard]);


  /** Media for one question: the saved record when there is one, otherwise a
   *  fresh timeline of the kind the teacher chose. */
  const openEditor = async (questionId: string, kind: QuestionMediaType = "video") => {
    if (!blockId) return;
    const cfg = await loadQuestionVideo(blockId, questionId).catch(() => null);
    setEditorConfig(cfg);
    setEditorKind(cfg?.videoPath ? mediaTypeOf(cfg) : kind);
    setEditorFor(questionId);
  };

  /** Media button: one entry point, then Video or Audio for a new record. */
  const MediaButton = ({
    questionId,
    saved,
    variant = "outline",
  }: {
    questionId: string;
    saved: QuestionVideoConfig | null | boolean;
    variant?: "outline" | "ghost";
  }) => {
    const cfg = typeof saved === "boolean" ? null : saved;
    const has = typeof saved === "boolean" ? saved : videoReady(saved);
    if (has) {
      return (
        <Button
          size="sm"
          variant={variant}
          className="pointer-events-auto"
          onClick={() => void openEditor(questionId)}
        >
          {cfg && mediaTypeOf(cfg) === "audio" ? (
            <AudioLines className="mr-1.5 h-4 w-4" />
          ) : (
            <MonitorPlay className="mr-1.5 h-4 w-4" />
          )}
          Edit media
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={variant} className="pointer-events-auto">
            <MonitorPlay className="mr-1.5 h-4 w-4" /> Media
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => void openEditor(questionId, "video")}>
            <MonitorPlay className="mr-2 h-4 w-4" /> Video
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openEditor(questionId, "audio")}>
            <AudioLines className="mr-2 h-4 w-4" /> Audio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading exercise…
      </div>
    );
  }

  const backToList = () => { params.delete("q"); setParams(params, { replace: true }); };

  // A question was chosen: the ONLY wait is its own hidden test container.
  // The video is never on the critical path.
  if (activeQuestionId && !testBoard && !testError) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening test board…
      </div>
    );
  }

  if (activeQuestionId && testError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{testError}</p>
        <Button variant="outline" onClick={backToList}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to questions
        </Button>
      </div>
    );
  }

  // ── The EXISTING Test Smartboard for one question ───────────────────────
  if (activeQuestionId && testBoard && boardSource) {
    const scopeKey = buildBoardScope({
      studentId: uid,
      classId: testBoard.classId,
      workspace: "floating_test",
      assessmentId: testBoard.assessmentId,
      questionId: activeQuestionId,
    });

    const board = (
      <PresentationView
        key={`${scopeKey}#${testBoard.sittingId}#${sitting}`}
        role="student"
        source={boardSource}
        assessmentId={testBoard.assessmentId}
        classId={testBoard.classId}
        workspace="floating_test"
        boardStudentId={uid}
        boardQuestionId={activeQuestionId}
        testMode
        onLineContext={videoReady(activeVideo) ? setLineCtx : undefined}
      />
    );

    return (
      <>
        <div className="fixed inset-0 flex bg-background">
          <div className={evalFull ? "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" : "relative flex-1 min-w-0"}>
            {videoReady(activeVideo) && activeVideo ? (
              // Same sitting key as the board: leaving and returning starts a
              // fresh test sitting, so the Introduction and Line 1 play again.
              <ThreeViewFrame
                key={`${scopeKey}#${testBoard.sittingId}#${sitting}`}
                config={activeVideo}
                lines={activeLines}
                lineContext={lineCtx}
                view={videoView}
                board={board}
              />

            ) : (
              board
            )}
          </div>
          {evalOpen && uid && (
            <div className={evalFull ? "flex-1 min-w-0 overflow-hidden" : "w-[24%] min-w-[260px] flex-none overflow-hidden"}>
              <RecoveryBoundary label="Evaluation">
                <TeacherEvaluationPanel
                  assessmentId={testBoard.assessmentId}
                  studentId={uid}
                  questionId={activeQuestionId}
                  studentName="Test"
                  localLive
                  fullscreen={evalFull}
                  onToggleFullscreen={() => setEvalFull((v) => !v)}
                  onClose={() => { setEvalFull(false); setEvalOpen(false); }}
                />
              </RecoveryBoundary>
            </div>
          )}
        </div>

        <div className="pointer-events-none fixed left-3 top-3 z-[70] flex items-center gap-2">
          <MediaButton questionId={activeQuestionId} saved={activeVideo} />
          {videoReady(activeVideo) && (
            <BoardViewSwitcher
              value={videoView}
              onChange={setVideoView}
              className="pointer-events-auto"
            />
          )}

        </div>

        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="text-xs text-muted-foreground">Viewing:</div>
            <div className="text-xs font-semibold">Test</div>
            <button
              type="button"
              onClick={() => setEvalOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${evalOpen ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
              title="Live evaluation"
            >
              <Brain className="h-3.5 w-3.5" /> Evaluation
            </button>
            <span className="text-[11px] text-muted-foreground">
              Nothing saved · {testBoard.total} marks
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={restart}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restart
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={backToList}>
              Exit test
            </Button>
          </div>
        </div>

        {editorFor && courseId && blockId && (
          <QuestionVideoEditor
            open
            onOpenChange={(o) => { if (!o) setEditorFor(null); }}
            courseId={courseId}
            blockId={blockId}
            questionId={editorFor}
            questionLabel={`Question ${questions.findIndex((q) => q.id === editorFor) + 1}`}
            lines={videoLinesFromQuestion(questions.find((q) => q.id === editorFor)?.lines)}
            config={editorConfig}
            mediaType={editorKind}

            onSaved={(cfg) => {
              setActiveVideo(cfg);
              setWithVideo((prev) => {
                const next = new Set(prev);
                if (cfg) next.add(editorFor); else next.delete(editorFor);
                return next;
              });
            }}
          />
        )}
      </>
    );
  }


  // ── Question list ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to={
            classId
              ? `/teaching-hub/classes/${classId}/courses/${courseId}/exercises`
              : `/course-builder/${courseId}`
          }
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {classId ? "Back to exercise cards" : "Back to course"}
        </Link>

        <h1 className="mt-3 inline-flex items-center gap-2 text-lg font-semibold">
          <ClipboardList className="h-5 w-5" /> {card?.title ?? loaded?.title ?? "Exercise"}
        </h1>
        {entries.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.length} question{entries.length === 1 ? "" : "s"} · {card?.total ?? 0} marks
          </p>
        )}

        {entries.length === 0 ? (
          <p className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            This Exercise Card has no linked questions yet. Link questions from your lesson notes in
            Courses first.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {entries.map((entry, i) => {
              const hasVideo = withVideo.has(entry.questionId);
              const lines = videoLinesFromQuestion(entry.payload?.lines as never).length;
              return (
                <li
                  key={entry.linkId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Question {i + 1}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.marks} marks
                      {entry.missing ? " · source not found — relink or remove" : ` · ${lines} lines`}
                      {hasVideo ? " · teaching media" : ""}
                    </span>
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {entry.missing ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await removeExerciseLink(entry.linkId);
                          await load();
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            params.set("q", entry.questionId);
                            setParams(params);
                          }}
                        >
                          <Play className="mr-1.5 h-4 w-4" /> View
                        </Button>
                        <MediaButton
                          questionId={entry.questionId}
                          saved={hasVideo}
                          variant="ghost"
                        />
                      </>
                    )}
                  </div>
                </li>

              );
            })}
          </ul>
        )}
      </div>

      {editorFor && courseId && blockId && (
        <QuestionVideoEditor
          open
          onOpenChange={(o) => { if (!o) setEditorFor(null); }}
          courseId={courseId}
          blockId={blockId}
          questionId={editorFor}
          questionLabel={`Question ${questions.findIndex((q) => q.id === editorFor) + 1}`}
          lines={videoLinesFromQuestion(questions.find((q) => q.id === editorFor)?.lines)}
          config={editorConfig}
          mediaType={editorKind}
          onSaved={(cfg) => {
            setWithVideo((prev) => {
              const next = new Set(prev);
              if (cfg) next.add(editorFor); else next.delete(editorFor);
              return next;
            });
          }}
        />
      )}
    </div>
  );
};

export default TeacherExerciseQuestionsPage;
