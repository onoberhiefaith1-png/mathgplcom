// Teacher Speed Performance — pick a timed assignment, read the records.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classRoot } from "@/lib/product/workspaceRoutes";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import TeacherSpeedPanel from "@/components/reports/speed/TeacherSpeedPanel";
import { reportSurfaceClass, useReportSettings } from "@/components/reports/reportTheme";
import {
  loadMemberNames,
  loadRecordHistory,
  loadTeacherSpeedPerformance,
  loadTimedAssignments,
  type RecordHistoryEntry,
  type TeacherSpeedRow,
} from "@/lib/reports/speedPerformance";

type Assignment = { notebookId: string; title: string; subject: string | null };

const ClassSpeedPerformancePage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { settings } = useReportSettings();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notebookId, setNotebookId] = useState<string>("");
  const [rows, setRows] = useState<TeacherSpeedRow[]>([]);
  const [history, setHistory] = useState<RecordHistoryEntry[]>([]);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());

  const subject = useMemo(
    () => assignments.find((a) => a.notebookId === notebookId)?.subject ?? "—",
    [assignments, notebookId],
  );

  const refresh = useCallback(async (nid: string) => {
    if (!classId) return;
    const speedRows = await loadTeacherSpeedPerformance(classId, nid || null);
    setRows(speedRows);
    setHistory(await loadRecordHistory(Array.from(new Set(speedRows.map((r) => r.assessmentId)))));
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/report/speed`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }
      const [{ data: cls }, list, names] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        loadTimedAssignments(classId),
        loadMemberNames(classId),
      ]);
      if (cancelled) return;
      setClassName((cls as { name?: string } | null)?.name ?? "");
      setAssignments(list);
      setMemberNames(names);
      const first = list[0]?.notebookId ?? "";
      setNotebookId(first);
      await refresh(first);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, refresh]);

  useEffect(() => {
    if (!classId || loading) return;
    const ch = supabase
      .channel(`class-speed-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_timer_attempts" },
        () => { void refresh(notebookId); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, loading, notebookId, refresh]);

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
          to={`${classRoot()}/${classId}/report`}
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
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[hsl(var(--rp-border))] p-3 text-xs">
            <div className="text-[hsl(var(--rp-muted))]">Class</div>
            <div className="mt-1 text-sm font-semibold">{className || "Class"}</div>
          </div>
          <div className="rounded-xl border border-[hsl(var(--rp-border))] p-3 text-xs">
            <div className="text-[hsl(var(--rp-muted))]">Subject</div>
            <div className="mt-1 text-sm font-semibold">{subject}</div>
          </div>
          <label className="rounded-xl border border-[hsl(var(--rp-border))] p-3 text-xs">
            <span className="text-[hsl(var(--rp-muted))]">Assignment</span>
            <select
              value={notebookId}
              onChange={(e) => { setNotebookId(e.target.value); void refresh(e.target.value); }}
              className="mt-1 w-full rounded-md border border-[hsl(var(--rp-border))] bg-transparent px-2 py-1.5 text-sm"
            >
              {assignments.length === 0 && <option value="">No assignments</option>}
              {assignments.map((a) => (
                <option key={a.notebookId} value={a.notebookId}>{a.title}</option>
              ))}
            </select>
          </label>
        </div>

        <TeacherSpeedPanel rows={rows} history={history} memberNames={memberNames} />
      </main>
    </div>
  );
};

export default ClassSpeedPerformancePage;
