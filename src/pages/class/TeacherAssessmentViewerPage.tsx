// Teacher — read-only viewer of a specific student's Assessment SmartBoard.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, Pencil, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import PresentationView from "@/components/smartboard/PresentationView";
import TeacherReasoningPanel from "@/components/smartboard/TeacherReasoningPanel";
import {
  buildAssessmentBoardSource,
  type AssessmentLike,
} from "@/lib/assessments/assessmentBoardSource";

const TeacherAssessmentViewerPage = () => {
  const { classId, assessmentId, studentId } = useParams<{ classId: string; assessmentId: string; studentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || `/teaching-hub/classes/${classId}`;
  // Students write one board per question — mirror the same scope here.
  // When the teacher arrives without an explicit ?q=, follow whichever question
  // the student is actually working on; otherwise both sides would join
  // different sessions and nothing would mirror.
  const explicitQuestionId = searchParams.get("q");
  const [followedQuestionId, setFollowedQuestionId] = useState<string | null>(null);
  const questionId = explicitQuestionId ?? followedQuestionId;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Poll the student's most recently touched question board and follow it.
  useEffect(() => {
    if (explicitQuestionId || !assessmentId || !studentId) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("assessment_question_board_state")
        .select("question_id, updated_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const qid = (data?.[0] as { question_id?: string } | undefined)?.question_id ?? null;
      if (qid) setFollowedQuestionId((prev) => (prev === qid ? prev : qid));
    };
    void tick();
    const id = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [explicitQuestionId, assessmentId, studentId]);


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
        <div className="relative flex-1 min-w-0">
          <PresentationView
            role="teacher"
            source={source}
            notebookId={(assessment as unknown as { notebook_id?: string | null })?.notebook_id ?? null}
            assessmentId={assessmentId ?? null}
            classId={classId ?? null}
            key={questionId ?? assessmentId ?? "assessment"}
            boardStudentId={studentId ?? null}
            boardQuestionId={questionId}
            viewOnly={!editMode}
          />
        </div>
        {reasoningOpen && assessmentId && studentId && (
          <div className="w-[20%] min-w-[260px] flex-none overflow-hidden">
            <TeacherReasoningPanel
              assessmentId={assessmentId}
              studentId={studentId}
              studentName={studentName}
              onClose={() => setReasoningOpen(false)}
            />
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
            title="Mathematical Reasoning (live debug)"
          >
            <Brain className="h-3.5 w-3.5" /> Reasoning
          </button>
        </div>
      </div>
    </>
  );
};

export default TeacherAssessmentViewerPage;
