// Teacher — viewer for a specific student's Assessment SmartBoard. Renders
// the same PresentationView the student sees. This project's PresentationView
// does not expose a `readOnly` or `viewStudentId` prop, so any local edits
// stay ephemeral (they cannot be persisted onto the student's row because
// row-level security scopes writes to the student).

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import PresentationView from "@/components/smartboard/PresentationView";
import {
  buildAssessmentBoardSource,
  type AssessmentLike,
} from "@/lib/assessments/assessmentBoardSource";

type MemberRow = { user_id: string; display_name: string | null };

const TeacherAssessmentViewerPage = () => {
  const { classId, assessmentId, studentId } = useParams<{ classId: string; assessmentId: string; studentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || `/teaching-hub/classes/${classId}`;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!classId || !assessmentId || !studentId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate(`/auth?redirect=${window.location.pathname}`); return; }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const [{ data: a }, { data: mem }] = await Promise.all([
        supabase.from("assessments").select("id, title, questions").eq("id", assessmentId).maybeSingle(),
        supabase.rpc("get_class_member_names", { _class_id: classId }),
      ]);
      if (!a) { navigate(returnTo, { replace: true }); return; }
      setAssessment(a as unknown as AssessmentLike);
      const m = ((mem ?? []) as MemberRow[]).find((x) => x.user_id === studentId);
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
      <PresentationView
        role="teacher"
        source={source}
        assessmentId={assessmentId ?? null}
        classId={classId ?? null}
      />

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
        </div>
      </div>
    </>
  );
};

export default TeacherAssessmentViewerPage;
