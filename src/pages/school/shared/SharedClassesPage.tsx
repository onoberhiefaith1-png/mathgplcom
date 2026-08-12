import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Loader2, Users } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchMemberClasses } from "@/lib/accounts/schoolDirectory";

/**
 * The teacher's classes inside this school. Students, assignments and progress
 * live inside a class — that is why they are not sections of their own.
 */
const SharedClassesPage = ({ userId }: { userId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const classes = useQuery({
    queryKey: ["school-member-classes", orgId, userId],
    queryFn: async () => fetchMemberClasses(orgId!, userId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="classes"
      title="Classes"
      subtitle="Classes the teacher created inside this school. Open a class to review its students, assignments, adventures and progress. Only the teacher can create or edit classes here."
    >
      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : classes.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
        </p>
      ) : (classes.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          No classes in this shared workspace yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(classes.data ?? []).map((c) => (
            <li key={c.id}>
              <Link
                to={`/school/teachers/${userId}/classes/${c.id}`}
                className="block h-full rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/60 hover:bg-card"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.students} student{c.students === 1 ? "" : "s"} · {c.assignments} assignment
                  {c.assignments === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        Reports for these classes roll up into the school report. A student in several classes is still one student in
        the school&rsquo;s count.
      </p>
    </SharedWorkspaceShell>
  );
};

export default SharedClassesPage;
