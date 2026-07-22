// Teacher — Assignment Dashboard for a single lesson note. Aggregates every
// assessment authored under that note in this class, shows In Progress /
// Completed / Inactive buckets, and lets the teacher open any student's
// SmartBoard to observe or assist.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { loadLessonProgress, type LessonAssessment, type LessonMember } from "@/lib/assessments/lessonProgress";
import { AssessmentStatusPanel, type StudentProgressRow } from "@/components/dashboards/AssessmentStatusPanel";
import { assessmentPresenceTopic } from "@/lib/realtime/lessonPresence";

type NotebookMeta = { id: string; title: string | null; subtopic: string | null; subject: string | null };

const AssignmentDashboardPage = () => {
  const { classId, notebookId } = useParams<{ classId: string; notebookId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState<string>("");
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [assessments, setAssessments] = useState<LessonAssessment[]>([]);
  const [members, setMembers] = useState<LessonMember[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [rows, setRows] = useState<StudentProgressRow[]>([]);
  const [firstAssessmentId, setFirstAssessmentId] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (
    a: LessonAssessment[] = assessments,
    m: LessonMember[] = members,
    active: Set<string> = activeSet,
  ) => {
    const r = await loadLessonProgress(a, m, active);
    setRows(r);
  }, [assessments, members, activeSet]);

  useEffect(() => {
    (async () => {
      if (!classId || !notebookId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/teaching-hub/classes/${classId}/assignments/${notebookId}/dashboard`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const [{ data: cls }, { data: nb }, { data: cmRows }, { data: ass }] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        supabase.from("notebooks").select("id, title, subtopic, subject").eq("id", notebookId).maybeSingle(),
        supabase.from("class_members").select("user_id").eq("class_id", classId),
        supabase
          .from("assessments")
          .select("id, total_marks, kind, unassigned_at")
          .eq("class_id", classId)
          .eq("notebook_id", notebookId)
          .is("unassigned_at", null),
      ]);
      setClassName((cls as { name?: string } | null)?.name ?? "");
      setNotebook((nb as NotebookMeta | null) ?? null);
      const userIds = ((cmRows ?? []) as { user_id: string }[]).map((r) => r.user_id);
      const nameByUid = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        for (const p of (profs ?? []) as { user_id: string; display_name: string | null }[]) {
          nameByUid.set(p.user_id, p.display_name ?? "Student");
        }
      }
      const memList: LessonMember[] = userIds.map((uid) => ({
        user_id: uid,
        display_name: nameByUid.get(uid) ?? "Student",
      }));
      const assList = ((ass ?? []) as { id: string; total_marks: number | null; kind: string | null }[])
        .filter((x) => x.kind !== "adventure")
        .map((x) => ({ id: x.id, total_marks: Number(x.total_marks ?? 0) }));
      setMembers(memList);
      setStudentCount(memList.length);
      setAssessments(assList);
      setFirstAssessmentId(assList[0]?.id ?? null);
      const r = await loadLessonProgress(assList, memList, new Set());
      setRows(r);
      setLoading(false);
    })();
  }, [classId, notebookId, navigate]);

  useEffect(() => { void refresh(assessments, members); }, [assessments, members, refresh]);

  useEffect(() => {
    if (!classId || assessments.length === 0) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`assignment-dashboard-${notebookId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress" },
          () => { void refresh(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, notebookId, assessments, refresh]);

  useEffect(() => {
    if (!classId || assessments.length === 0) return;
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const perAssessment = new Map<string, Set<string>>();
    const recompute = () => {
      const merged = new Set<string>();
      for (const s of perAssessment.values()) for (const u of s) merged.add(u);
      if (!cancelled) setActiveSet(merged);
    };
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      for (const a of assessments) {
        const ch = supabase.channel(assessmentPresenceTopic(classId, a.id), {
          config: { presence: { key: `observer-${a.id}` } },
        });
        const emit = () => {
          const state = ch.presenceState() as Record<string, Array<{ user_id?: string }>>;
          const set = new Set<string>();
          for (const key of Object.keys(state)) {
            if (key.startsWith("observer-")) continue;
            set.add(key);
            for (const meta of state[key]) if (meta.user_id) set.add(meta.user_id);
          }
          perAssessment.set(a.id, set);
          recompute();
        };
        ch
          .on("presence", { event: "sync" }, emit)
          .on("presence", { event: "join" }, emit)
          .on("presence", { event: "leave" }, emit)
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") { await ch.track({ role: "observer" }); emit(); }
          });
        channels.push(ch);
      }
    });
    return () => {
      cancelled = true;
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [classId, assessments]);

  const totalMarks = assessments.reduce((s, a) => s + a.total_marks, 0);

  const onView = (studentId: string) => {
    const aid = firstAssessmentId;
    if (!aid) return;
    navigate(`/teaching-hub/classes/${classId}/assessments/${aid}/student/${studentId}?returnTo=${encodeURIComponent(`/teaching-hub/classes/${classId}/assignments/${notebookId}/dashboard`)}`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/teaching-hub/classes/${classId}/assignments`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Assignments
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <ClipboardList className="h-5 w-5" /> Assignment Dashboard
        </h1>
        <div className="w-28" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Class" value={className || "—"} />
                <Field label="Topic" value={notebook?.subject || "—"} />
                <Field label="Subtopic" value={notebook?.subtopic || "—"} />
                <Field label="Total Students" value={String(studentCount)} />
                <Field label="Total Questions" value={String(assessments.length)} />
                <Field label="Total Marks" value={String(totalMarks)} />
              </div>
            </section>

            <AssessmentStatusPanel rows={rows} onViewStudent={onView} />
          </>
        )}
      </main>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-sm font-semibold">{value}</div>
  </div>
);

export default AssignmentDashboardPage;
