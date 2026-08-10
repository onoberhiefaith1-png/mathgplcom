import { Users } from "lucide-react";

import { Link } from "@/lib/router-compat";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useConnections } from "@/lib/connections/useConnections";

/** Every student connected to this teacher; each opens their workspace read-only. */
const TeacherStudentsPage = () => {
  const { data: accepted, isLoading } = useConnections("accepted");
  const students = (accepted ?? []).filter((c) => c.counterpartRole === "student");

  return (
    <WorkspaceLayout title="My Students" subtitle="Students connected to you">
      <section className="rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : students.length === 0 ? (
          <EmptyNote>
            No connected students yet. Students appear here once a connection request is accepted.
          </EmptyNote>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {students.map((student) => (
              <li key={student.id}>
                <Link
                  to={`/teaching-hub/students/${student.counterpartUserId}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-4 transition hover:border-ws-gold/50"
                >
                  <Users className="h-4 w-4 shrink-0 text-ws-violet" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{student.counterpartName}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {student.counterpartMathgplId ?? "—"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorkspaceLayout>
  );
};

export default TeacherStudentsPage;
