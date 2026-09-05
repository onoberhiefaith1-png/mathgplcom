import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher Report — two lenses on the same recorded assessment data:
// Individual Student (default, detailed) and Class Overview (simple).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import ProgressBarChart from "@/components/reports/ProgressBarChart";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import ReportSettingsSheet from "@/components/reports/ReportSettingsSheet";
import TrendLineChart from "@/components/reports/TrendLineChart";
import TrendRangeBar from "@/components/reports/TrendRangeBar";
import ReportModeSwitch, { type ReportMode } from "@/components/reports/ReportModeSwitch";
import IndividualStudentReport from "@/components/reports/IndividualStudentReport";
import ClassOverviewReport from "@/components/reports/ClassOverviewReport";
import SpeedPerformanceCard from "@/components/reports/SpeedPerformanceCard";
import { buildTrendSeries } from "@/lib/reports/trendChart";
import {
  reportSurfaceClass,
  useReportSettings,
  type ReportFilter,
  type TrendGrouping,
} from "@/components/reports/reportTheme";
import { loadReportData, type ClassMember, type TaskBar } from "@/lib/reports/progressChart";
import { loadStudentReport, type StudentAssessmentRow } from "@/lib/reports/studentReport";

const TREND_SUBTITLE: Record<TrendGrouping, string> = {
  week: "Average performance per week (Sunday → Saturday).",
  month: "Average performance per month.",
  year: "Average performance per year.",
};

const MODE_KEY = "mathgpl.report.mode.v1";

const ClassReportPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [classBars, setClassBars] = useState<TaskBar[]>([]);
  const [rowsByStudent, setRowsByStudent] = useState<Map<string, StudentAssessmentRow[]>>(new Map());
  const [mode, setMode] = useState<ReportMode>("student");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("both");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update, updateTrendColor } = useReportSettings();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "class" || saved === "student") setMode(saved);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage unavailable */ }
  }, [mode]);

  const refresh = useCallback(async () => {
    if (!classId) return;
    const [{ members: m, classBars: cb }, detail] = await Promise.all([
      loadReportData(classId),
      loadStudentReport(classId),
    ]);
    setMembers(m);
    setClassBars(cb);
    setRowsByStudent(detail.rowsByStudent);
    setStudentId((cur) => cur ?? m[0]?.user_id ?? null);
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/report`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }
      const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
      if (cancelled) return;
      setClassName((cls as { name?: string } | null)?.name ?? "");
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, refresh]);

  // Keep the report live as students earn marks.
  useEffect(() => {
    if (!classId || loading) return;
    const ch = supabase
      .channel(`class-report-${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_progress" }, () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, loading, refresh]);

  const trendPoints = useMemo(
    () => buildTrendSeries(classBars, { grouping: settings.trendGrouping, filter }),
    [classBars, settings.trendGrouping, filter],
  );
  const studentRows = useMemo(
    () => (studentId ? rowsByStudent.get(studentId) ?? [] : []),
    [studentId, rowsByStudent],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }

  return (
    <div className={`${reportSurfaceClass(settings)} min-h-screen w-full bg-[hsl(var(--rp-bg))] text-[hsl(var(--rp-fg))]`}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <Link
            to={`${classRoot()}/${classId}`}
            className="inline-flex items-center gap-2 text-sm text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
            <p className="text-xs text-[hsl(var(--rp-muted))]">Student assessments and class performance.</p>
          </div>
        </div>

        <ReportModeSwitch value={mode} onChange={setMode} />

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
        <SpeedPerformanceCard
          to={`${classRoot()}/${classId}/report/speed`}
          subtitle="Overall best times, record holders and record history."
        />

        {mode === "student" ? (
          <IndividualStudentReport
            className={className}
            members={members}
            selectedStudentId={studentId}
            onSelectStudent={setStudentId}
            rows={studentRows}
          />
        ) : (
          <ClassOverviewReport
            className={className}
            members={members}
            rowsByStudent={rowsByStudent}
            onOpenStudent={(id) => { setStudentId(id); setMode("student"); }}
          >
            <div className="mb-4 flex justify-end">
              <ReportFilterBar value={filter} onChange={setFilter} />
            </div>
            <ProgressBarChart
              bars={classBars}
              settings={settings}
              filter={filter}
              title="Class Report"
              subtitle={`Average completion per task across ${members.length} student${members.length === 1 ? "" : "s"}.`}
            />
            {settings.showTrend && (
              <div className="mt-6 space-y-3">
                <div className="flex justify-end">
                  <TrendRangeBar value={settings.trendGrouping} onChange={(v) => update("trendGrouping", v)} />
                </div>
                <TrendLineChart
                  points={trendPoints}
                  settings={settings}
                  title="Class Trend"
                  subtitle={TREND_SUBTITLE[settings.trendGrouping]}
                />
              </div>
            )}
          </ClassOverviewReport>
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

export default ClassReportPage;
