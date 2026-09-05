// Student Speed Performance — my best times against the anonymous overall best.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StudentSpeedTable from "@/components/reports/speed/StudentSpeedTable";
import { reportSurfaceClass, useReportSettings } from "@/components/reports/reportTheme";
import { loadStudentSpeedPerformance, type StudentSpeedRow } from "@/lib/reports/speedPerformance";

const StudentSpeedPerformancePage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { settings } = useReportSettings();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentSpeedRow[]>([]);

  const refresh = useCallback(async () => {
    if (!classId) return;
    setRows(await loadStudentSpeedPerformance(classId));
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/report/speed`);
        return;
      }
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, refresh]);

  // The dashboard reacts to the existing timer data as new attempts land.
  useEffect(() => {
    if (!classId || loading) return;
    const ch = supabase
      .channel(`student-speed-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_timer_attempts" },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, loading, refresh]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Speed Performance…
      </div>
    );
  }

  return (
    <div className={`${reportSurfaceClass(settings)} min-h-screen w-full bg-[hsl(var(--rp-bg))] text-[hsl(var(--rp-fg))]`}>
      <header className="flex items-center justify-between gap-3 px-6 py-5">
        <Link
          to={`/student/class/${classId}/report`}
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
        >
          <ArrowLeft className="h-4 w-4" /> Reports
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Gauge className="h-5 w-5" /> Speed Performance
        </h1>
        <span className="w-16" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <p className="mb-4 text-xs text-[hsl(var(--rp-muted))]">
          Your fastest successful time per question, next to the fastest time recorded by anyone.
          Record holders stay anonymous.
        </p>
        <div className="rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-4">
          <StudentSpeedTable rows={rows} />
        </div>
      </main>
    </div>
  );
};

export default StudentSpeedPerformancePage;
