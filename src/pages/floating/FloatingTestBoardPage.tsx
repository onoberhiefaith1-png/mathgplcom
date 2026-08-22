// Floating Number → Test on Smartboard.
//
// The teacher's temporary sitting on the REAL student Smartboard, scoped to the
// ONE question/solution they are preparing. Nothing else from the lesson note
// is loaded, and nothing is recorded: writing, marking, scoring, hints and the
// Evaluation panel all run through the existing student engine.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, RotateCcw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PresentationView from "@/components/smartboard/PresentationView";
import TeacherReasoningPanel from "@/components/smartboard/TeacherReasoningPanel";
import { buildBoardScope, clearBoardScope } from "@/lib/smartboard/boardScope";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import { ensureFloatingTestBoard, type FloatingTestBoard } from "@/lib/floating/testBoard";
import { friendlyMessage } from "@/lib/net/resilient";

const FloatingTestBoardPage = () => {
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const navigate = useNavigate();

  const [uid, setUid] = useState<string | null>(null);
  const [board, setBoard] = useState<FloatingTestBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sitting, setSitting] = useState(0);
  // Teacher-side Evaluation panel (same engine as the student-work viewer).
  const [evalOpen, setEvalOpen] = useState(true);
  const [evalFull, setEvalFull] = useState(false);

  const backTo = `/lesson-notes/${notebookId}/floating/${subsectionId}`;

  const open = useCallback(async () => {
    if (!subsectionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      if (!id) {
        navigate(`/auth?redirect=${encodeURIComponent(`${backTo}/test`)}`);
        return;
      }
      setUid(id);
      const next = await ensureFloatingTestBoard(subsectionId);
      // Every entry is a fresh sitting: drop any board cache from last time.
      clearBoardScope(
        buildBoardScope({
          studentId: id,
          classId: next.classId,
          workspace: "floating_test",
          assessmentId: next.assessmentId,
          questionId: subsectionId,
        }),
      );
      setBoard(next);
    } catch (e) {
      setError(
        (e as Error)?.message && !(e as { status?: number }).status
          ? String((e as Error).message)
          : friendlyMessage(e, "Could not open the test board."),
      );
    } finally {
      setLoading(false);
    }
  }, [subsectionId, navigate, backTo]);

  useEffect(() => { void open(); }, [open]);

  // Leaving the test discards the sitting entirely.
  useEffect(() => {
    if (!board || !uid || !subsectionId) return;
    const scope = buildBoardScope({
      studentId: uid,
      classId: board.classId,
      workspace: "floating_test",
      assessmentId: board.assessmentId,
      questionId: subsectionId,
    });
    return () => { clearBoardScope(scope); };
  }, [board, uid, subsectionId]);

  const boardSource = useMemo(() => {
    if (!board) return null;
    return buildAssessmentBoardSource({
      id: board.assessmentId,
      title: `${board.title} — test`,
      questions: [board.question] as never,
    } as never);
  }, [board]);

  const restart = () => {
    if (board && uid && subsectionId) {
      clearBoardScope(
        buildBoardScope({
          studentId: uid,
          classId: board.classId,
          workspace: "floating_test",
          assessmentId: board.assessmentId,
          questionId: subsectionId,
        }),
      );
    }
    setSitting((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening test board…
      </div>
    );
  }

  if (error || !board || !boardSource) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {error ?? "This solution has no floating numbers to test yet."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(backTo)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to floating numbers
          </Button>
          <Button onClick={() => void open()}>Try again</Button>
        </div>
      </div>
    );
  }

  const scopeKey = buildBoardScope({
    studentId: uid,
    classId: board.classId,
    workspace: "floating_test",
    assessmentId: board.assessmentId,
    questionId: subsectionId,
  });

  return (
    <>
      <div className="fixed inset-0 flex bg-background">
        {/* Kept mounted in Evaluation full screen so the live board keeps running. */}
        <div className={evalFull ? "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" : "relative flex-1 min-w-0"}>
          <PresentationView
            key={`${scopeKey}#${board.sittingId}#${sitting}`}
            role="student"
            source={boardSource}
            notebookId={board.notebookId}
            assessmentId={board.assessmentId}
            classId={board.classId}
            workspace="floating_test"
            boardStudentId={uid}
            boardQuestionId={subsectionId ?? null}
            testMode
          />
        </div>
        {evalOpen && uid && (
          <div className={evalFull ? "flex-1 min-w-0 overflow-hidden" : "w-[24%] min-w-[260px] flex-none overflow-hidden"}>
            <TeacherReasoningPanel
              assessmentId={board.assessmentId}
              studentId={uid}
              questionId={subsectionId ?? null}
              studentName="Test"
              localLive
              fullscreen={evalFull}
              onToggleFullscreen={() => setEvalFull((v) => !v)}
              onClose={() => { setEvalFull(false); setEvalOpen(false); }}
            />
          </div>
        )}
      </div>

      {/* No View Only / Edit controls: this is the teacher testing the question
          themselves, not a visit to a real student's workspace. */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => navigate(backTo)}
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
            Nothing saved · {board.total} marks
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={restart}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restart
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => navigate(backTo)}>
            Exit test
          </Button>
        </div>
      </div>
    </>
  );
};

export default FloatingTestBoardPage;
