import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useConnections } from "@/lib/connections/useConnections";

/**
 * One connected student's workspace, seen by their teacher.
 *
 * Observation, not impersonation: the teacher stays signed in as themselves,
 * only the classes they own are shown, and no authoring control is rendered.
 */
const TeacherStudentWorkspacePage = ({ userId }: { userId: string }) => {
  const { data: accepted } = useConnections("accepted");
  const student = (accepted ?? []).find((c) => c.counterpartUserId === userId) ?? null;

  const shared = useQuery({
    queryKey: ["teacher-student-classes", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user;
      if (!me) return [] as { id: string; name: string }[];
      const { data: mine } = await supabase.from("classes").select("id, name").eq("owner_id", me.id);
      const rows = (mine ?? []) as { id: string; name: string | null }[];
      if (rows.length === 0) return [];
      const { data: members } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", userId)
        .in("class_id", rows.map((r) => r.id));
      const joined = new Set(((members ?? []) as { class_id: string }[]).map((m) => m.class_id));
      return rows.filter((r) => joined.has(r.id)).map((r) => ({ id: r.id, name: r.name || "Class" }));
    },
  });

  return (
    <WorkspaceLayout
      title={student ? `${student.counterpartName}'s workspace` : "Student workspace"}
      subtitle="View only — observed from your Teaching Hub"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link
          to="/teaching-hub/students"
          className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" /> <span className="truncate">Back to my students</span>
        </Link>
        <Link
          to="/teaching-hub"
          className="shrink-0 rounded-full border border-ws-gold/50 px-4 py-2 text-xs text-ws-gold transition hover:bg-ws-gold/10"
        >
          Exit workspace
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-ws-gold/40 bg-ws-gold/10 px-4 py-2 text-xs text-ws-gold">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">
          Viewing {student?.counterpartName ?? "this student"}&rsquo;s workspace — nothing here can be edited.
        </span>
      </div>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="text-lg font-semibold">{student?.counterpartName ?? "Student"}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{student?.counterpartUsername ? `@${student.counterpartUsername}` : "—"}</p>
        <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
          This workspace belongs to the student. You see only the classes you own that they have joined.
        </p>
      </section>

      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-ws-gold/80">
          Classes we share
        </h2>
        {shared.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening workspace…
          </p>
        ) : (shared.data ?? []).length === 0 ? (
          <EmptyNote>This student has not joined any of your classes yet.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {(shared.data ?? []).map((cls) => (
              <li key={cls.id}>
                <Link
                  to={`/class/${cls.id}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3 transition hover:border-ws-gold/50"
                >
                  <Users className="h-4 w-4 shrink-0 text-ws-violet" />
                  <span className="truncate text-sm">{cls.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceLayout>
  );
};

export default TeacherStudentWorkspacePage;
