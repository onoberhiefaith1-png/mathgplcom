// Student Assessment Board — the SAME SmartBoard the teacher uses, scoped to a
// single assigned question. The student writes the solution line-by-line with
// the full board tools + floating numbers, and taps "Check" per line. Grading
// is server-authoritative (the answer key never reaches this client).

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PresentationView from "@/components/smartboard/PresentationView";
import {
  buildAssessmentBoardSource,
  type AssessmentLike,
} from "@/lib/assessments/assessmentBoardSource";

const AssessmentBoardPage = () => {
  const { classId, assessmentId } = useParams<{ classId: string; assessmentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!assessmentId || !classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/assessment/${assessmentId}`);
        return;
      }

      // Membership firewall.
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!membership) { navigate("/join"); return; }

      const { data: a } = await supabase
        .from("assessments")
        .select("id, title, questions")
        .eq("id", assessmentId)
        .maybeSingle();
      if (cancelled) return;
      if (!a) { navigate(`/student/class/${classId}`); return; }

      // Ensure a progress row exists so restore + grading have a home.
      await supabase
        .from("assessment_progress")
        .upsert(
          { assessment_id: assessmentId, student_id: userData.user.id, status: "in_progress" },
          { onConflict: "assessment_id,student_id", ignoreDuplicates: true },
        );

      setAssessment(a as unknown as AssessmentLike);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assessmentId, classId, navigate]);

  const source = useMemo(
    () => (assessment ? buildAssessmentBoardSource(assessment) : null),
    [assessment],
  );

  if (loading || !source) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening assignment…
      </div>
    );
  }

  return (
    <PresentationView
      role="student"
      source={source}
      assessmentId={assessmentId ?? null}
      classId={classId ?? null}
    />
  );
};

export default AssessmentBoardPage;
