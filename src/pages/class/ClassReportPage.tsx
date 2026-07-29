// Teacher Report — Class Report first, with a switch to any student's report.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import ProgressBarChart from "@/components/reports/ProgressBarChart";
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
  const selectedName = selected === "class"
    ? "Class Report"
    : `${members.find((m) => m.user_id === selected)?.display_name ?? "Student"} — Student Report`;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/teaching-hub/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {className || "Class"}
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <BarChart3 className="h-5 w-5" /> Report
        </h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelected("class")}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              selected === "class" ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Class
          </button>
          <select
            value={selected === "class" ? "" : selected}
            onChange={(e) => setSelected(e.target.value ? e.target.value : "class")}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold text-foreground"
            aria-label="Select student"
          >
            <option value="">Student ▾</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
            ))}
          </select>
        </div>

        <ProgressBarChart
          bars={bars}
          title={selectedName}
          subtitle={
            selected === "class"
              ? `Average completion per task across ${members.length} student${members.length === 1 ? "" : "s"}.`
              : "Completion per assigned task."
          }
        />
      </main>
    </div>
  );
};

export default ClassReportPage;
