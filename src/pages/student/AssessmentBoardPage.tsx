// Student Assessment Board.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
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

type TimerSettings = { timer_enabled: boolean; opens_at: string | null; closes_at: string | null };

// Timer columns ship with this change, so the generated types don't know them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

const AssessmentBoardPage = () => {
  const { classId, assessmentId } = useParams<{ classId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const questionParam = searchParams.get("q");
  const openedFrom = searchParams.get("source");
  const gameId = searchParams.get("game");
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Meta | null>(null);
  const [status, setStatus] = useState<string>("in_progress");
  const [uid, setUid] = useState<string | null>(null);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    timer_enabled: false, opens_at: null, closes_at: null,
  });

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

      const { data: t } = await db
        .from("assessments")
        .select("timer_enabled, opens_at, closes_at")
        .eq("id", assessmentId)
        .maybeSingle();
      if (!cancelled && t) {
        setTimerSettings({
          timer_enabled: !!t.timer_enabled,
          opens_at: t.opens_at ?? null,
          closes_at: t.closes_at ?? null,
        });
      }

      setAssessment(a as unknown as Meta);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assessmentId, classId, navigate]);

  // PRESENCE CARRIES THE OPEN QUESTION. The teacher's live viewer must know
  // which question the student is on the instant it joins — before the first
  // board frame — so the question id travels in the presence record and is
  // re-tracked whenever the student moves to another question.
  const presenceQuestionRef = useRef<string | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!classId || !assessmentId || !uid) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let tracked = false;
    const track = async () => {
      if (!channel) return;
      await channel.track({
        user_id: uid,
        source: openedFrom === "adventure" || !!gameId ? "adventure" : "assignment",
        questionId: presenceQuestionRef.current,
        at: Date.now(),
      });
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
      presenceChannelRef.current = channel;
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
      presenceChannelRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [classId, assessmentId, uid, openedFrom, gameId]);


  // EVERY question gets its own Smartboard. When the URL omits ?q= (the
  // assignment path), fall back to the assessment's first question so the
  // board is never run in the legacy "one shared board per assessment" mode.
  const questionId = useMemo(
    () => questionParam ?? (assessment?.questions?.[0]?.id ?? null),
    [questionParam, assessment],
  );

  useEffect(() => {
    presenceQuestionRef.current = questionId;
    const ch = presenceChannelRef.current;
    if (!ch || !uid) return;
    void ch.track({
      user_id: uid,
      source: openedFrom === "adventure" || !!gameId ? "adventure" : "assignment",
      questionId,
      at: Date.now(),
    });
  }, [questionId, uid, openedFrom, gameId]);

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



  const now = Date.now();
  const notOpenYet = !!timerSettings.opens_at && new Date(timerSettings.opens_at).getTime() > now;
  const isClosed = !!timerSettings.closes_at && new Date(timerSettings.closes_at).getTime() <= now;
  const isPastDue = (!!assessment?.due_at && new Date(assessment.due_at).getTime() <= Date.now()) || isClosed;
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

  if (notOpenYet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center text-muted-foreground">
        <div className="text-lg font-semibold text-foreground">This assignment isn't open yet</div>
        <div className="text-sm">
          It opens on {new Date(timerSettings.opens_at!).toLocaleString()}.
        </div>
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
        timerEnabled={timerSettings.timer_enabled}
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
