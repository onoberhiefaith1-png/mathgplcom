// Student Report — a student only ever sees their own progress chart.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProgressBarChart from "@/components/reports/ProgressBarChart";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import ReportSettingsSheet from "@/components/reports/ReportSettingsSheet";
import TrendLineChart from "@/components/reports/TrendLineChart";
import TrendRangeBar from "@/components/reports/TrendRangeBar";
import { buildTrendSeries } from "@/lib/reports/trendChart";
import {
  reportSurfaceClass,
  useReportSettings,
  type ReportFilter,
  type TrendGrouping,
} from "@/components/reports/reportTheme";

const TREND_SUBTITLE: Record<TrendGrouping, string> = {
  week: "Your average performance per week (Sunday → Saturday).",
  month: "Your average performance per month.",
  year: "Your average performance per year.",
};
import { loadStudentTaskBars, type TaskBar } from "@/lib/reports/progressChart";

const StudentReportPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [bars, setBars] = useState<TaskBar[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("both");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update, updateTrendColor } = useReportSettings();

  const trendPoints = useMemo(
    () => buildTrendSeries(bars, { grouping: settings.trendGrouping, filter }),
    [bars, settings.trendGrouping, filter],
  );

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
    <div className={`${reportSurfaceClass(settings)} min-h-screen w-full bg-[hsl(var(--rp-bg))] text-[hsl(var(--rp-fg))]`}>
      <header className="flex items-center justify-between gap-3 px-6 py-5">
        <Link
          to={`/student/class/${classId}`}
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
        >
          <ArrowLeft className="h-4 w-4" /> {className || "Class"}
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <BarChart3 className="h-5 w-5" /> My Report
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Report settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--rp-border))] text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-4 flex justify-end">
          <ReportFilterBar value={filter} onChange={setFilter} />
        </div>
        <ProgressBarChart
          bars={bars}
          settings={settings}
          filter={filter}
          title="Student Report"
          subtitle="Completion per assigned task."
        />

        {settings.showTrend && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-end">
              <TrendRangeBar value={settings.trendGrouping} onChange={(v) => update("trendGrouping", v)} />
            </div>
            <TrendLineChart
              points={trendPoints}
              settings={settings}
              title="My Trend"
              subtitle={TREND_SUBTITLE[settings.trendGrouping]}
            />
          </div>
        )}
      </main>

      <ReportSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        update={update}
        updateTrendColor={updateTrendColor}
      />
    </div>
  );
};

export default StudentReportPage;
