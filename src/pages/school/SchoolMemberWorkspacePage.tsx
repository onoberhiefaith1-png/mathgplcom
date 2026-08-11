import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, BookOpen, Building2, Eye, Flag, Globe2, GraduationCap, Loader2, NotebookPen, Users } from "lucide-react";

import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchMemberClasses, fetchMemberOverview } from "@/lib/accounts/schoolDirectory";

/**
 * One member's school workspace, seen by the school administrator.
 *
 * This is observation, not impersonation: the administrator stays signed in as
 * the school, every read is school-scoped in SQL, and no authoring, submitting
 * or building control is rendered at all. The page opens the way the member's
 * own workspace opens — the school's rotating building first, then their work
 * inside this school.
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
        ...(kind === "teacher"
          ? [{ label: "Students taught", value: person.students, icon: GraduationCap }]
          : []),
        { label: "Lesson notes", value: person.lessonNotes, icon: NotebookPen },
        { label: "Assignments", value: person.assignments, icon: BookOpen },
        { label: "Adventures", value: person.adventures, icon: Flag },
        { label: "Average progress", value: `${person.avgProgress}%`, icon: Flag },
      ]
    : [];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to {kind === "teacher" ? "teachers" : "students"}
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Shared Workspace · {active?.name ?? "School"}
        </span>
        <WorkspaceSwitcher compact />
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <Eye className="h-3.5 w-3.5" />
          Shared Workspace — {active?.name ?? "this school"} · {person?.displayName ?? "this member"}. This is not their
          Personal Workspace. Teaching content here is view only; the Building belongs to the school.
        </div>

        {!orgId ? (
          <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            Switch to your school to open its Shared Workspaces.
          </p>
        ) : overview.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening shared workspace…
          </p>
        ) : !person ? (
          <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
            This person is not connected to your school.
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
                {person.displayName} is connected to {active?.name ?? "this school"}. That connection created this
                Shared Workspace: the school&rsquo;s Building plus{" "}
                {kind === "teacher" ? "their Teaching Hub inside this school" : "their learning inside this school"}.
                Their Personal Workspace is separate and stays private to them.
              </p>
            </section>

            {/* The shared workspace opens on the school's building, exactly as
                the member sees it — and only the school may change it. */}
            <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
              {/* The scene renders full-viewport by design; this frame crops it
                  into the page without letting it take over the layout. */}
              <div className="relative h-[300px] w-full overflow-hidden [&>main]:!absolute [&>main]:!inset-0 [&>main]:!h-full [&>main]:!w-full">
                <RotatingAdventureScene interactive={false} configMode="school-readonly" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  The school&rsquo;s Building and background — what {person.displayName} sees inside this Shared
                  Workspace. The school controls it; the teacher cannot change it.
                </p>
                <Link
                  to="/homepage/building"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Building2 className="h-4 w-4" /> Edit Building
                </Link>
              </div>
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
                {kind === "teacher" ? "Teaching Hub in this school" : "Learning in this school"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "teacher"
                  ? "Everything this teacher has created inside this school: classes, lesson notes, adventures and assignments. Work they made in another workspace never appears here."
                  : "Everything this student is doing inside this school: their classes, assignments, adventures and Smartboard work."}
              </p>
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

            <section className="mt-4 rounded-2xl border border-border bg-card/60 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Globe2 className="h-4 w-4 text-sky-300" /> MathGPL Community
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {person.displayName} keeps one Community presence across every workspace. Anything they choose to share
                there is theirs to publish or withdraw — the school can see it, never change it.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SchoolMemberWorkspacePage;
