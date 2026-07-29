import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — Assignments list.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, ClipboardList, Loader2, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";

type Assessment = { id: string; title: string; kind: string; total_marks: number; notebook_id: string | null; assigned_at: string | null; due_at: string | null };
type NotebookMeta = { id: string; title: string | null; subtopic: string | null };

const ClassAssignmentsPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [notebooks, setNotebooks] = useState<Record<string, NotebookMeta>>({});

  useEffect(() => {
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/assignments`);
        return;
      }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const { data: ass } = await supabase
        .from("assessments")
        .select("id, title, kind, total_marks, notebook_id, section_id, assigned_at, due_at, unassigned_at")
        .eq("class_id", classId)
        .is("unassigned_at", null)
        .order("created_at", { ascending: false });
      const raw = ((ass ?? []) as Assessment[]).filter((a) => a.kind !== "adventure");

      const notebookIds = Array.from(new Set(raw.map((a) => a.notebook_id).filter(Boolean))) as string[];
      if (notebookIds.length) {
        const { data: nbs } = await supabase.from("notebooks").select("id, title, subtopic").in("id", notebookIds);
        const map: Record<string, NotebookMeta> = {};
        for (const n of (nbs ?? []) as NotebookMeta[]) map[n.id] = n;
        setNotebooks(map);
      }

      setAssessments(raw);
      setLoading(false);

    })();
  }, [classId, navigate]);

  const groups = (() => {
    const map = new Map<string, { key: string; notebookId: string | null; label: string; sub: string | null; items: Assessment[] }>();
    for (const a of assessments) {
      const key = a.notebook_id ?? `solo:${a.id}`;
      const nb = a.notebook_id ? notebooks[a.notebook_id] : null;
      const label = nb?.title || a.title;
      const sub = nb?.subtopic ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.items.push(a);
      else map.set(key, { key, notebookId: a.notebook_id, label, sub, items: [a] });
    }
    return Array.from(map.values());
  })();

  const toDateInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

  const saveDue = async (ids: string[], value: string) => {
    const iso = value ? new Date(value).toISOString() : null;
    await supabase.from("assessments").update({ due_at: iso } as never).in("id", ids);
    setAssessments((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, due_at: iso } : a)));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`${classRoot()}/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <ClipboardList className="h-5 w-5" /> Assignments
        </h1>
        <div className="w-28" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No assignments yet. Open a lesson note and use the Assign button on a Solution.
          </div>
        ) : (
          groups.map((g) => {
            const totalMarks = g.items.reduce((s, a) => s + (Number(a.total_marks) || 0), 0);
            const assignedAt = g.items.map((a) => a.assigned_at).filter(Boolean).sort()[0] as string | undefined;
            const dueAt = g.items.map((a) => a.due_at).filter(Boolean).sort()[0] as string | undefined;
            const ids = g.items.map((a) => a.id);
            return (
              <section key={g.key} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lesson Note</div>
                    <div className="text-lg font-semibold">{g.label}</div>
                    {g.sub && <div className="text-xs text-muted-foreground">{g.sub}</div>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{g.items.length} question{g.items.length === 1 ? "" : "s"}</div>
                    <div className="tabular-nums">{totalMarks} marks total</div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">Date Assigned</div>
                    <div className="rounded-md border border-input bg-muted/20 px-3 py-1.5 tabular-nums">
                      {assignedAt ? new Date(assignedAt).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="mb-1 text-muted-foreground">Date to Complete</div>
                    <input
                      type="date"
                      value={toDateInput(dueAt)}
                      onChange={(e) => saveDue(ids, e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  {g.notebookId ? (
                    <Link
                      to={`${classRoot()}/${classId}/assignments/${g.notebookId}/dashboard`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" /> Assignment Dashboard
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Standalone assignment</span>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
};

export default ClassAssignmentsPage;
