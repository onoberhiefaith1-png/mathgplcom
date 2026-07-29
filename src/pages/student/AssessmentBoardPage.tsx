// Student Assessment Board.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PresentationView from "@/components/smartboard/PresentationView";
import { buildBoardScope } from "@/lib/smartboard/boardScope";

import {
  buildAssessmentBoardSource,
  type AssessmentLike,
} from "@/lib/assessments/assessmentBoardSource";
import { assessmentPresenceTopic } from "@/lib/realtime/lessonPresence";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { useAdventureHeartbeat } from "@/hooks/useAdventureHeartbeat";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";

type Meta = AssessmentLike & { due_at: string | null };

const AssessmentBoardPage = () => {
  const { classId, assessmentId } = useParams<{ classId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const questionParam = searchParams.get("q");
  const openedFrom = searchParams.get("source");
  const gameId = searchParams.get("game");
  const shouldTrackPresence =
    openedFrom === "assignment" || openedFrom === "adventure" || !!gameId;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Meta | null>(null);
  const [status, setStatus] = useState<string>("in_progress");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!assessmentId || !classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/assessment/${assessmentId}`);
        return;
      }
      setUid(userData.user.id);

      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!membership) { navigate("/join"); return; }

      const { data: a } = await supabase
        .from("assessments")
        .select("id, title, questions, due_at, notebook_id")
        .eq("id", assessmentId)
        .maybeSingle();
      if (cancelled) return;
      if (!a) { navigate(`/student/class/${classId}`); return; }

      await supabase
        .from("assessment_progress")
        .upsert(
          { assessment_id: assessmentId, student_id: userData.user.id, status: "in_progress" },
          { onConflict: "assessment_id,student_id", ignoreDuplicates: true },
        );
      const { data: prog } = await supabase
        .from("assessment_progress")
        .select("status")
        .eq("assessment_id", assessmentId)
        .eq("student_id", userData.user.id)
        .maybeSingle();
      setStatus(prog?.status ?? "in_progress");

      setAssessment(a as unknown as Meta);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assessmentId, classId, navigate]);

  useEffect(() => {
    if (!shouldTrackPresence || !classId || !assessmentId || !uid) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let tracked = false;
    const track = async () => {
      if (!channel || tracked) return;
      await channel.track({ user_id: uid, source: "adventure", at: Date.now() });
      tracked = true;
    };
    const untrack = async () => {
      if (!channel || !tracked) return;
      await channel.untrack();
      tracked = false;
    };
    const onHide = () => { void untrack(); };
    (async () => {
      await ensureRealtimeAuth();
      if (cancelled) return;
      const topic = assessmentPresenceTopic(classId, assessmentId);
      channel = supabase.channel(topic, { config: { presence: { key: uid } } });
      channel.subscribe(async (s) => {
        if (s === "SUBSCRIBED") await track();
      });
      window.addEventListener("pagehide", onHide);
      window.addEventListener("beforeunload", onHide);
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      if (channel) supabase.removeChannel(channel);
    };
  }, [shouldTrackPresence, classId, assessmentId, uid]);


  // EVERY question gets its own Smartboard. When the URL omits ?q= (the
  // assignment path), fall back to the assessment's first question so the
  // board is never run in the legacy "one shared board per assessment" mode.
  const questionId = useMemo(
    () => questionParam ?? (assessment?.questions?.[0]?.id ?? null),
    [questionParam, assessment],
  );

  // Keep ?q= in the URL so refresh / back restores the same question board.
  useEffect(() => {
    if (questionParam || !questionId) return;
    const next = new URLSearchParams(searchParams);
    next.set("q", questionId);
    setSearchParams(next, { replace: true });
  }, [questionParam, questionId, searchParams, setSearchParams]);

  const boardSource = useMemo(() => {
    if (!assessment) return null;
    const scoped = questionId
      ? { ...assessment, questions: (assessment.questions ?? []).filter((q) => q.id === questionId) }
      : assessment;
    return buildAssessmentBoardSource(scoped.questions?.length ? scoped : assessment);
  }, [assessment, questionId]);



  const isPastDue = !!assessment?.due_at && new Date(assessment.due_at).getTime() <= Date.now();
  const isAdventure = openedFrom === "adventure" || !!gameId;

  const timeBar = useGameTimeBar(gameId);
  const timeExpired = isAdventure && timeBar.expired;

  useAdventureHeartbeat({
    enabled: isAdventure,
    classId,
    gameId,
    assessmentId,
    questionId,
    studentId: uid,
  });

  const onSubmit = useCallback(async () => {
    if (!assessmentId || !uid) return;
    const nextCompleted = status !== "completed";
    const { error } = await supabase
      .from("assessment_progress")
      .update({
        status: nextCompleted ? "completed" : "in_progress",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("assessment_id", assessmentId)
      .eq("student_id", uid);
    if (error) {
      toast({ title: "Could not update submission", description: error.message, variant: "destructive" });
      return;
    }
    setStatus(nextCompleted ? "completed" : "in_progress");
    toast({
      title: nextCompleted ? "Submitted" : "Submission reopened",
      description: nextCompleted
        ? "You can undo your submission until the due date."
        : "Your assignment is editable again.",
    });
  }, [assessmentId, uid, status, toast]);

  if (loading || !boardSource) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening assignment…
      </div>
    );
  }

  const showSubmit = !isPastDue && !isAdventure && !timeExpired;
  const readOnly = isPastDue || timeExpired;

  // The board is identified by student × class × workspace × game ×
  // assessment × question. Using that identity as the React key forces a
  // clean remount whenever ANY of them changes, so no state survives a
  // switch between questions, classes or workspaces.
  const workspace = isAdventure ? "adventure" : "assignment";
  const scopeKey = buildBoardScope({
    studentId: uid,
    classId,
    workspace,
    gameId,
    assessmentId,
    questionId,
  });

  return (
    <>
      <PresentationView
        key={scopeKey}
        role="student"
        source={boardSource}
        notebookId={(assessment as unknown as { notebook_id?: string | null })?.notebook_id ?? null}
        assessmentId={assessmentId ?? null}
        classId={classId ?? null}
        workspace={workspace}
        gameId={gameId}
        boardStudentId={uid}
        boardQuestionId={questionId}
        viewOnly={readOnly}
      />


      {!isAdventure && status === "completed" && !isPastDue && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-700 shadow-sm">
          Submitted — press "Undo Submit" to reopen before the due date.
        </div>
      )}
      {isPastDue && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-border bg-background/90 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          Assignment closed — viewing only.
        </div>
      )}
      {timeExpired && !isPastDue && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-destructive/50 bg-destructive/10 px-4 py-1.5 text-xs font-medium text-destructive shadow-sm">
          Time expired — waiting for your teacher to add time or reset the timer.
        </div>
      )}
    </>
  );
};

export default AssessmentBoardPage;
