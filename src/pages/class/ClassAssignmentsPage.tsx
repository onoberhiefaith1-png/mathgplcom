// Teacher monitoring — per-student progress for every assignment in a class.
// Shows opened/not-opened, current score and completion. The hidden marking
// logic (answer keys) is never surfaced here.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

type Member = { user_id: string; display_name: string };
type Assessment = { id: string; title: string; kind: string; score_label: string; total_marks: number };
type Progress = { assessment_id: string; student_id: string; score: number; status: string };

const ClassAssignmentsPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);

  const loadProgress = async (ids: string[]) => {
    if (!ids.length) { setProgress([]); return; }
    const { data } = await supabase
      .from("assessment_progress")
      .select("assessment_id, student_id, score, status")
      .in("assessment_id", ids);
    setProgress((data ?? []) as Progress[]);
  };

  useEffect(() => {
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/teaching-hub/classes/${classId}/assignments`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const [{ data: mem }, { data: ass }] = await Promise.all([
        supabase.rpc("get_class_member_names", { _class_id: classId }),
        supabase
          .from("assessments")
          .select("id, title, kind, score_label, total_marks")
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
      ]);
      setMembers((mem ?? []) as Member[]);
      const list = (ass ?? []) as Assessment[];
      setAssessments(list);
      await loadProgress(list.map((a) => a.id));
      setLoading(false);
    })();
  }, [classId, navigate]);

  // Live score refresh as students work.
  useEffect(() => {
    if (!classId || assessments.length === 0) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const ids = assessments.map((a) => a.id);
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-assessments-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessment_progress" },
          () => { loadProgress(ids); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, assessments]);

  const progFor = (assessmentId: string, studentId: string) =>
    progress.find((p) => p.assessment_id === assessmentId && p.student_id === studentId);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/teaching-hub/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <ClipboardList className="h-5 w-5" /> Assignments
        </h1>
        <div className="w-28" />
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No assignments yet. Open a lesson note and use the Assign button on a Solution.
          </div>
        ) : (
          assessments.map((a) => (
            <section key={a.id} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.kind}</div>
                  <div className="text-lg font-semibold">{a.title}</div>
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {a.total_marks} {a.score_label} total
                </div>
              </div>

              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground">No students in this class yet.</div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const p = progFor(a.id, m.user_id);
                        const status = !p ? "Not opened" : p.status === "completed" ? "Completed" : "In progress";
                        return (
                          <tr key={m.user_id} className="border-t border-border">
                            <td className="px-3 py-2">{m.display_name}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                {status === "Completed" && <Check className="h-3.5 w-3.5" style={{ color: "hsl(142 70% 45%)" }} />}
                                <span className={p ? "" : "text-muted-foreground"}>{status}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {p?.score ?? 0} / {a.total_marks}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
};

export default ClassAssignmentsPage;
