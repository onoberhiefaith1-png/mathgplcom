// Student Report — a student only ever sees their own progress chart.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProgressBarChart from "@/components/reports/ProgressBarChart";
import { loadStudentTaskBars, type TaskBar } from "@/lib/reports/progressChart";

const StudentReportPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [bars, setBars] = useState<TaskBar[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);

  const refresh = useCallback(async (uid: string) => {
    if (!classId) return;
    setBars(await loadStudentTaskBars(classId, uid));
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/report`);
        return;
      }
      const uid = userData.user.id;
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", uid)
        .maybeSingle();
      const { data: cls } = await supabase.from("classes").select("name, owner_id").eq("id", classId).maybeSingle();
      const isOwner = (cls as { owner_id?: string } | null)?.owner_id === uid;
      if (!membership && !isOwner) { navigate("/join"); return; }
      if (cancelled) return;
      setClassName((cls as { name?: string } | null)?.name ?? "");
      setStudentId(uid);
      await refresh(uid);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, refresh]);

  useEffect(() => {
    if (!classId || !studentId || loading) return;
    const ch = supabase
      .channel(`student-report-${classId}-${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_progress", filter: `student_id=eq.${studentId}` },
        () => { void refresh(studentId); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, studentId, loading, refresh]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your report…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {className || "Class"}
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <BarChart3 className="h-5 w-5" /> My Report
        </h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <ProgressBarChart bars={bars} title="Student Report" subtitle="Completion per assigned task." />
      </main>
    </div>
  );
};

export default StudentReportPage;
