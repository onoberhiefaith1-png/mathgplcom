import { useQuery } from "@tanstack/react-query";
import { BookOpen, Compass, Eye, Loader2, TrendingUp, Users } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedClassDetail } from "@/lib/accounts/sharedWorkspace";

/** One class inside the shared workspace, reviewed by the school. */
const SharedClassDetailPage = ({ userId, classId }: { userId: string; classId: string }) => {
  const { person } = useSharedMember(userId);

  const detail = useQuery({
    queryKey: ["shared-class-detail", classId],
    queryFn: async () => fetchSharedClassDetail(classId),
  });

  const data = detail.data;
  const stats = data
    ? [
        { label: "Students", value: data.students.length, icon: Users },
        { label: "Assignments", value: data.assignments.length, icon: BookOpen },
        { label: "Adventures", value: data.adventures, icon: Compass },
        { label: "Average progress", value: `${data.avgProgress}%`, icon: TrendingUp },
      ]
    : [];

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="classes"
      title={data?.name ?? "Class"}
      subtitle="Everything inside this class: its students, assignments, adventures and progress. Only the teacher can change any of it."
    >
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
        <Eye className="h-3.5 w-3.5" /> Teacher action required to create or edit anything in this class
      </div>

      {detail.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening class…
        </p>
      ) : !data ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          This class is not part of this shared workspace.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-card/50 p-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <section className="mt-5 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-lg font-semibold">Students</h2>
            {data.students.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No students have joined this class yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {data.students.map((s) => (
                  <li key={s.userId} className="py-2.5 text-sm">
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-lg font-semibold">Assignments</h2>
            {data.assignments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No assignments in this class yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {data.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span>{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.status ?? "draft"}
                      {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedClassDetailPage;
