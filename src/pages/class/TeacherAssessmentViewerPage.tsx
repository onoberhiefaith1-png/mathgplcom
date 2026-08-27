import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — viewer of a specific student's Assessment SmartBoard.
//
// Two modes (see src/lib/assessments/viewerFollow.ts):
//   • Join Student Live — the board follows the student in real time and
//     switches question the moment the student does. The signal is the
//     student's own board broadcast, not a database poll.
//   • View Student Work — the teacher picks a question and reads saved work.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Eye, Pencil, Brain, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { assessmentPresenceTopic } from "@/lib/realtime/lessonPresence";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import PresentationView from "@/components/smartboard/PresentationView";
import TeacherEvaluationPanel from "@/components/smartboard/TeacherEvaluationPanel";
import { buildBoardScope } from "@/lib/smartboard/boardScope";
import RecoveryBoundary from "@/components/common/RecoveryBoundary";
import { usePolling } from "@/lib/stability/usePolling";
import {
  initialViewerMode,
  resolveViewerQuestionId,
  type ViewerMode,
} from "@/lib/assessments/viewerFollow";

import {
  buildAssessmentBoardSource,
  type AssessmentLike,
} from "@/lib/assessments/assessmentBoardSource";

const TeacherAssessmentViewerPage = () => {
  const { classId, assessmentId, studentId } = useParams<{ classId: string; assessmentId: string; studentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || `${classRoot()}/${classId}`;
  const explicitQuestionId = searchParams.get("q");
  const requestedMode = searchParams.get("mode");

  const [mode, setMode] = useState<ViewerMode>(() =>
    initialViewerMode({ explicitQuestionId, requestedMode }),
  );
  const modeChosenRef = useRef<boolean>(!!explicitQuestionId || requestedMode === "live" || requestedMode === "work");
  const [liveQuestionId, setLiveQuestionId] = useState<string | null>(null);
  const [lastFrameAt, setLastFrameAt] = useState<number>(0);
  const [pickedQuestionId, setPickedQuestionId] = useState<string | null>(null);
  const [persistedQuestionId, setPersistedQuestionId] = useState<string | null>(null);
  const [studentOnline, setStudentOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [reasoningFull, setReasoningFull] = useState(false);

  const questions = useMemo(() => assessment?.questions ?? [], [assessment]);
  const questionId = resolveViewerQuestionId({
    mode,
    explicitQuestionId,
    liveQuestionId,
    pickedQuestionId,
    lastPersistedQuestionId: persistedQuestionId,
    firstQuestionId: questions[0]?.id ?? null,
  });

  // ── Instant follow signal. The student's Smartboard broadcasts a snapshot on
  // every board change (~120ms) on a question-agnostic channel, and every
  // frame carries the question the student is on. This is the ONLY fast,
  // correct source: the persisted board row only appears after a debounced
  // write, so a freshly opened question would never show up. ────────────────
  useEffect(() => {
    if (!assessmentId || !studentId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assessment-live-${assessmentId}-${studentId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "board" }, (msg) => {
          const p = (msg as { payload?: { questionId?: string | null } }).payload;
          if (!p) return;
          setLastFrameAt(Date.now());
          const qid = p.questionId ?? null;
          if (qid) setLiveQuestionId((prev) => (prev === qid ? prev : qid));
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [assessmentId, studentId]);

  // ── Presence — is the student on the board right now? Drives the indicator
  // and the default mode on first load. ────────────────────────────────────
  useEffect(() => {
    if (!classId || !assessmentId || !studentId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const read = () => {
      if (!ch) return;
      const state = ch.presenceState() as Record<string, unknown[]>;
      const online = Object.keys(state).includes(studentId);
      if (!cancelled) setStudentOnline(online);
      if (!cancelled && online && !modeChosenRef.current) {
        modeChosenRef.current = true;
        setMode("live");
      }
    };
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase.channel(assessmentPresenceTopic(classId, assessmentId));
      ch.on("presence", { event: "sync" }, read)
        .on("presence", { event: "join" }, read)
        .on("presence", { event: "leave" }, read)
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, assessmentId, studentId]);

  // Broadcast frames also prove the student is live even when presence lags.
  const liveFeedFresh = studentOnline || Date.now() - lastFrameAt < 8000;

  // ── Slow fallback: the last question the student actually persisted. Only
  // used when no live frame is available (student offline / session closed).
  const loadPersisted = useCallback(async () => {
    if (!assessmentId || !studentId) return;
    const { data } = await supabase
      .from("assessment_question_board_state")
      .select("question_id, updated_at")
      .eq("assessment_id", assessmentId)
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const qid = (data?.[0] as { question_id?: string } | undefined)?.question_id ?? null;
    if (qid) setPersistedQuestionId((prev) => (prev === qid ? prev : qid));
  }, [assessmentId, studentId]);

  useEffect(() => { void loadPersisted(); }, [loadPersisted]);
  usePolling("assessment-viewer-persisted-question", () => {
    if (liveQuestionId) return;
    return loadPersisted();
  }, 8000, { immediate: false });

  useEffect(() => {
    (async () => {
      if (!classId || !assessmentId || !studentId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate(`/auth?redirect=${window.location.pathname}`); return; }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const [{ data: a }, { data: mem }] = await Promise.all([
        supabase.from("assessments").select("id, title, questions, notebook_id").eq("id", assessmentId).maybeSingle(),
        supabase.rpc("get_class_member_names", { _class_id: classId }),
      ]);
      if (!a) { navigate(returnTo, { replace: true }); return; }
      setAssessment(a as unknown as AssessmentLike);
      const m = ((mem ?? []) as any[]).find((x) => x.user_id === studentId);
      setStudentName(m?.display_name ?? "Student");
      setLoading(false);
    })();
  }, [classId, assessmentId, studentId, navigate, returnTo]);

  const source = useMemo(() => {
    if (!assessment) return null;
    if (questionId) {
      const scoped = (assessment.questions ?? []).filter((q) => q.id === questionId);
      if (scoped.length) return buildAssessmentBoardSource({ ...assessment, questions: scoped });
    }
    return buildAssessmentBoardSource(assessment);
  }, [assessment, questionId]);


  if (loading || !source) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading student work…
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 flex bg-background">
        {/* Kept mounted (never unmounted) in Reasoning full screen so the live
            board subscription and evaluation keep running uninterrupted. */}
        <div className={reasoningFull ? "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" : "relative flex-1 min-w-0"}>
          <PresentationView
            role="teacher"
            source={source}
            notebookId={(assessment as unknown as { notebook_id?: string | null })?.notebook_id ?? null}
            assessmentId={assessmentId ?? null}
            classId={classId ?? null}
            workspace={searchParams.get("game") ? "adventure" : "assignment"}
            gameId={searchParams.get("game")}
            key={buildBoardScope({
              studentId,
              classId,
              workspace: searchParams.get("game") ? "adventure" : "assignment",
              gameId: searchParams.get("game"),
              assessmentId,
              questionId,
            })}
            boardStudentId={studentId ?? null}
            boardQuestionId={questionId}
            viewOnly={!editMode}
          />
        </div>
        {reasoningOpen && assessmentId && studentId && (
          <div className={reasoningFull ? "flex-1 min-w-0 overflow-hidden" : "w-[20%] min-w-[260px] flex-none overflow-hidden"}>
            <RecoveryBoundary label="Evaluation">
  <TeacherEvaluationPanel
                assessmentId={assessmentId}
                studentId={studentId}
                questionId={questionId}
                studentName={studentName}
                fullscreen={reasoningFull}
                onToggleFullscreen={() => setReasoningFull((v) => !v)}
                onClose={() => { setReasoningFull(false); setReasoningOpen(false); }}
              />
            </RecoveryBoundary>
          </div>
        )}

      </div>


      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="text-xs text-muted-foreground">Viewing:</div>
          <div className="text-xs font-semibold">{studentName}</div>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${editMode ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
            title={editMode ? "Return to view-only" : "Enable edit mode (local demo)"}
          >
            {editMode ? <><Pencil className="h-3.5 w-3.5" /> Edit Mode</> : <><Eye className="h-3.5 w-3.5" /> View Only</>}
          </button>
          <button
            type="button"
            onClick={() => setReasoningOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${reasoningOpen ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
            title="Live evaluation"
          >
            <Brain className="h-3.5 w-3.5" /> Evaluation
          </button>
        </div>
      </div>
    </>
  );
};

export default TeacherAssessmentViewerPage;
