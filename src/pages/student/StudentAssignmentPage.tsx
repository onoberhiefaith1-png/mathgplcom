// Student — per-lesson-note question list.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Check, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type NotebookMeta = { id: string; title: string | null; subtopic: string | null; topic: string | null; score_label: string | null };
type Assessment = {
  id: string;
  section_id: string | null;
  title: string;
  total_marks: number;
  assigned_at: string | null;
  due_at: string | null;
  created_at: string | null;
  score: number;
  completed: boolean;
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

const StudentAssignmentPage = () => {
  const { classId, notebookId } = useParams<{ classId: string; notebookId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notebook, setNotebook] = useState<NotebookMeta | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !notebookId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/assignment/${notebookId}`);
        return;
      }
      const uid = userData.user.id;

      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!membership) { navigate("/join"); return; }

      const [{ data: nb }, { data: ass }, { data: sects }] = await Promise.all([
        supabase.from("notebooks").select("id, title, subtopic, topic, score_label").eq("id", notebookId).maybeSingle(),
        supabase
          .from("assessments")
          .select("id, section_id, title, total_marks, assigned_at, due_at, created_at, unassigned_at, kind")
          .eq("class_id", classId)
          .eq("notebook_id", notebookId)
          .is("unassigned_at", null),
        supabase.from("notebook_sections").select("id, order_index").eq("notebook_id", notebookId).order("order_index", { ascending: true }),
      ]);
      if (cancelled) return;

      setNotebook((nb as any) ?? null);
      const order = new Map<string, number>();
      ((sects ?? []) as any[]).forEach((s, i) => order.set(s.id as string, i));

      const list = ((ass ?? []) as any[])
        .filter((r) => r.kind !== "adventure")
        .sort((a, b) => {
          const aOrder = a.section_id && order.has(a.section_id) ? order.get(a.section_id)! : Number.MAX_SAFE_INTEGER;
          const bOrder = b.section_id && order.has(b.section_id) ? order.get(b.section_id)! : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return String(a.assigned_at ?? a.created_at ?? "").localeCompare(String(b.assigned_at ?? b.created_at ?? ""));
        });

      const ids = list.map((r) => r.id as string);
      const progMap = new Map<string, { score: number; status: string }>();
      if (ids.length) {
        const { data: progs } = await supabase
          .from("assessment_progress")
          .select("assessment_id, score, status")
          .eq("student_id", uid)
          .in("assessment_id", ids);
        for (const p of progs ?? []) {
          progMap.set((p as any).assessment_id, { score: Number((p as any).score ?? 0), status: (p as any).status });
        }
      }

      setAssessments(list.map((r): Assessment => {
        const p = progMap.get(r.id as string);
        return {
          id: r.id,
          section_id: r.section_id ?? null,
          title: r.title ?? "Question",
          total_marks: Number(r.total_marks ?? 0),
          assigned_at: r.assigned_at ?? null,
          due_at: r.due_at ?? null,
          created_at: r.created_at ?? null,
          score: p?.score ?? 0,
          completed: p?.status === "completed",
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, notebookId, navigate]);

  const scoreLabel = notebook?.score_label?.trim() || "Marks";
  const totalMarks = useMemo(() => assessments.reduce((s, a) => s + a.total_marks, 0), [assessments]);
  const totalScore = useMemo(() => assessments.reduce((s, a) => s + a.score, 0), [assessments]);
  const assignedAt = useMemo(() => assessments.map((a) => a.assigned_at).filter(Boolean).sort()[0] ?? null, [assessments]);
  const dueAt = useMemo(() => assessments.map((a) => a.due_at).filter(Boolean).sort()[0] ?? null, [assessments]);
  const pastDue = !!dueAt && new Date(dueAt).getTime() <= Date.now();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading assignment…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold">
          <ClipboardList className="h-5 w-5" /> Assignment
        </h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-4">
        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Topic</div>
          <div className="text-lg font-semibold">{notebook?.title || notebook?.topic || "—"}</div>
          {notebook?.subtopic && (
            <div className="mt-0.5 text-sm text-muted-foreground">{notebook.subtopic}</div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            <Field label="Questions" value={String(assessments.length)} />
            <Field label={`Total ${scoreLabel}`} value={`${totalScore} / ${totalMarks}`} />
            <Field label="Assigned" value={fmtDate(assignedAt)} />
            <Field label="Due" value={fmtDate(dueAt)} />
          </div>
          {pastDue && (
            <div className="mt-3 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              This assignment is closed. You can still open your work in view-only mode.
            </div>
          )}
        </section>

        {assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No questions in this assignment yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {assessments.map((a, i) => (
              <li key={a.id}>
                <Link
                  to={`/student/class/${classId}/assessment/${a.id}?source=assignment`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Question {i + 1}</div>
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {a.score} / {a.total_marks} {scoreLabel}
                    </div>
                  </div>
                  {a.completed && <Check className="h-4 w-4 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

export default StudentAssignmentPage;
