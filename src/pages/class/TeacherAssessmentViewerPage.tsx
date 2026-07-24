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
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

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

  const source = useMemo(
    () => (assessment ? buildAssessmentBoardSource(assessment) : null),
    [assessment],
  );

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
        <div className={reasoningOpen ? "flex-1 min-w-0" : "flex-1 min-w-0"}>
          <PresentationView
            role="teacher"
            source={source}
            notebookId={(assessment as unknown as { notebook_id?: string | null })?.notebook_id ?? null}
            assessmentId={assessmentId ?? null}
            classId={classId ?? null}
            boardStudentId={studentId ?? null}
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
