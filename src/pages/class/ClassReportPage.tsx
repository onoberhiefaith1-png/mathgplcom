// Teacher Report — Class Report first, with a switch to any student's report.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, ChevronDown, Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
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
  week: "Average performance per week (Sunday → Saturday).",
  month: "Average performance per month.",
  year: "Average performance per year.",
};

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadReportData, type ClassMember, type TaskBar } from "@/lib/reports/progressChart";

const ClassReportPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [classBars, setClassBars] = useState<TaskBar[]>([]);
  const [barsByStudent, setBarsByStudent] = useState<Map<string, TaskBar[]>>(new Map());
  const [selected, setSelected] = useState<string | "class">("class");
  const [filter, setFilter] = useState<ReportFilter>("both");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update, updateTrendColor } = useReportSettings();

  const refresh = useCallback(async () => {
    if (!classId) return;
    const { members: m, classBars: cb, barsByStudent: bs } = await loadReportData(classId);
    setMembers(m);
    setClassBars(cb);
    setBarsByStudent(bs);
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/teaching-hub/classes/${classId}/report`);
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

  const bars = useMemo(
    () => (selected === "class" ? classBars : barsByStudent.get(selected) ?? []),
    [selected, classBars, barsByStudent],
  );
  const trendPoints = useMemo(
    () => buildTrendSeries(bars, { grouping: settings.trendGrouping, filter }),
    [bars, settings.trendGrouping, filter],
  );
  const selectedStudent = selected === "class" ? null : members.find((m) => m.user_id === selected);
  const selectedName = selectedStudent ? `${selectedStudent.display_name} — Student Report` : "Class Report";


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }

  return (
    <div className={`${reportSurfaceClass(settings)} min-h-screen w-full bg-[hsl(var(--rp-bg))] text-[hsl(var(--rp-fg))]`}>
      <header className="flex items-center justify-between gap-3 px-6 py-5">
        <Link
          to={`/teaching-hub/classes/${classId}`}
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--rp-muted))] transition hover:text-[hsl(var(--rp-fg))]"
        >
          <ArrowLeft className="h-4 w-4" /> {className || "Class"}
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <BarChart3 className="h-5 w-5" /> Report
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelected("class")}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              selected === "class"
                ? "border-transparent bg-[hsl(var(--rp-fg))] text-[hsl(var(--rp-panel))]"
                : "border-[hsl(var(--rp-border))] text-[hsl(var(--rp-muted))] hover:text-[hsl(var(--rp-fg))]"
            }`}
          >
            Class
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  selectedStudent
                    ? "border-transparent bg-[hsl(var(--rp-fg))] text-[hsl(var(--rp-panel))]"
                    : "border-[hsl(var(--rp-border))] text-[hsl(var(--rp-muted))] hover:text-[hsl(var(--rp-fg))]"
                }`}
              >
                {selectedStudent ? selectedStudent.display_name : "Student"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
              {members.length === 0 ? (
                <DropdownMenuItem disabled>No students enrolled</DropdownMenuItem>
              ) : (
                members.map((m) => (
                  <DropdownMenuItem key={m.user_id} onSelect={() => setSelected(m.user_id)}>
                    {m.display_name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto">
            <ReportFilterBar value={filter} onChange={setFilter} />
          </div>
        </div>

        <ProgressBarChart
          bars={bars}
          settings={settings}
          filter={filter}
          title={selectedName}
          subtitle={
            selected === "class"
              ? `Average completion per task across ${members.length} student${members.length === 1 ? "" : "s"}.`
              : "Completion per assigned task."
          }
        />

        {settings.showTrend && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-end">
              <TrendRangeBar value={settings.trendGrouping} onChange={(v) => update("trendGrouping", v)} />
            </div>
            <TrendLineChart
              points={trendPoints}
              settings={settings}
              title={selected === "class" ? "Class Trend" : `${selectedName} — Trend`}
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

export default ClassReportPage;
