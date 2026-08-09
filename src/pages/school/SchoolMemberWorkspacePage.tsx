import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, BookOpen, Eye, Flag, GraduationCap, Loader2, NotebookPen, Users } from "lucide-react";

import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchMemberClasses, fetchMemberOverview } from "@/lib/accounts/schoolDirectory";

/**
 * One member's school workspace, seen by the school administrator.
 *
 * This is observation, not impersonation: the administrator stays signed in as
 * the school, every read is school-scoped in SQL, and no authoring, submitting
 * or building control is rendered at all.
 */
const SchoolMemberWorkspacePage = ({ userId, kind }: { userId: string; kind: "teacher" | "student" }) => {
  const { active } = useWorkspace();
  const orgId = active?.kind === "school" ? active.orgId : null;

  const overview = useQuery({
    queryKey: ["school-member", orgId, userId],
    queryFn: async () => fetchMemberOverview(orgId!, userId),
    enabled: Boolean(orgId),
  });
  const classes = useQuery({
    queryKey: ["school-member-classes", orgId, userId],
    queryFn: async () => fetchMemberClasses(orgId!, userId),
    enabled: Boolean(orgId),
  });

  const person = overview.data;
  const backTo = kind === "teacher" ? "/school/teachers" : "/school/students";

  const stats = person
    ? [
        { label: "Classes", value: person.classes, icon: Users },
        kind === "teacher"
          ? { label: "Students taught", value: person.students, icon: GraduationCap }
          : { label: "Average progress", value: `${person.avgProgress}%`, icon: Flag },
        { label: "Lesson notes", value: person.lessonNotes, icon: NotebookPen },
        { label: "Assignments", value: person.assignments, icon: BookOpen },
        { label: "Adventures", value: person.adventures, icon: Flag },
        { label: "Average progress", value: `${person.avgProgress}%`, icon: Flag },
      ].slice(0, 5)
    : [];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to {kind === "teacher" ? "teachers" : "students"}
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {kind === "teacher" ? "Teacher School Workspace" : "Student School Workspace"}
        </span>
        <WorkspaceSwitcher compact />
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <Eye className="h-3.5 w-3.5" />
          Viewing {person?.displayName ?? "this member"}&rsquo;s school workspace — view only. Nothing here can be
          edited, submitted or created.
        </div>

        {!orgId ? (
          <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            Switch to your school workspace to observe its members.
          </p>
        ) : overview.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening workspace…
          </p>
        ) : !person ? (
          <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            This person is not a member of your school.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card/60 p-6">
              <h1 className="text-2xl font-semibold">{person.displayName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "teacher" ? "Teacher ID" : "Student ID"}: {person.mathgplId ?? "—"} · school status{" "}
                {person.status}
              </p>
              <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
                This is {person.displayName}&rsquo;s own workspace inside this school — their classes, work and records.
                It is not a generic dashboard, and it is not the school&rsquo;s own workspace.
              </p>
            </section>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            <section className="mt-6 rounded-2xl border border-border bg-card/60 p-6">
              <h2 className="text-lg font-semibold">
                {kind === "teacher" ? "Classes in this school" : "Classes this student belongs to"}
              </h2>
              {classes.isLoading ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
                </p>
              ) : (classes.data ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No classes in this school yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60">
                  {(classes.data ?? []).map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.students} student{c.students === 1 ? "" : "s"} · {c.assignments} assignment
                        {c.assignments === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Reports for these classes roll up into the school report. A student in several classes is still one
                student in the school&rsquo;s count.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SchoolMemberWorkspacePage;
