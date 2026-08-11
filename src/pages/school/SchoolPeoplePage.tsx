import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GraduationCap, Loader2, Search, Users } from "lucide-react";

import PersonAvatar from "@/components/accounts/PersonAvatar";
import SchoolShell from "@/components/accounts/SchoolShell";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchSchoolStudents, fetchSchoolTeachers } from "@/lib/accounts/schoolDirectory";

type Kind = "teachers" | "students";

const COPY: Record<Kind, { title: string; subtitle: string; empty: string; find: string; idLabel: string }> = {
  teachers: {
    title: "Teachers in This School",
    subtitle:
      "Only teachers actually connected to this school appear here. Open a teacher to see their connection and their Shared Workspace — never their Personal Workspace. The school never creates teacher accounts.",
    empty: "No teachers connected to this school yet.",
    find: "Find a Teacher",
    idLabel: "Teacher ID",
  },

  students: {
    title: "Students in This School",
    subtitle:
      "Only students belonging to this school appear here. Open a student to observe their own school workspace.",
    empty: "No students belong to this school yet.",
    find: "Find a Student",
    idLabel: "Student ID",
  },
};

/**
 * A directory of the real people connected to this school — never a generic
 * teacher or student dashboard. The people come first on the page; the ways to
 * connect more of them sit underneath, in the same place whether the roster is
 * empty or full. Each person owns their own school workspace, which the
 * administrator opens in view-only mode.
 */
const SchoolPeoplePage = ({ kind }: { kind: Kind }) => {
  const { active } = useWorkspace();
  const orgId = active?.kind === "school" ? active.orgId : null;
  const copy = COPY[kind];
  const Icon = kind === "teachers" ? GraduationCap : Users;

  const people = useQuery({
    queryKey: ["school-directory", kind, orgId],
    queryFn: async () => (kind === "teachers" ? fetchSchoolTeachers(orgId!) : fetchSchoolStudents(orgId!)),
    enabled: Boolean(orgId),
  });

  const rows = people.data ?? [];

  const connectActions = (
    <section className="mt-6 rounded-2xl border border-border bg-card/50 p-6">
      <h2 className="text-base font-semibold">Connect {kind === "teachers" ? "a teacher" : "a student"}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        People join a school by request: find them in the MathGPL Community, or enter the code they gave you. They
        accept, and then they appear above.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/community/discover"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Search className="h-4 w-4" /> {copy.find}
        </Link>
        <ConnectByCodeDialog
          trigger={
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 text-sm font-semibold"
            >
              Enter a code
            </button>
          }
        />
      </div>
    </section>
  );

  return (
    <SchoolShell
      title={copy.title}
      subtitle={copy.subtitle}
      nav={false}
      backTo="/school"
      backLabel="School Console"
    >
      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school workspace to see the people connected to it.
        </p>
      ) : people.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <>
          {rows.length === 0 ? (
            <section className="rounded-2xl border border-border bg-card/50 p-8 text-center">
              <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-base font-medium">{copy.empty}</p>
            </section>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((person) => (
                <article
                  key={person.userId}
                  className="flex flex-col rounded-2xl border border-border bg-card/60 p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={person.displayName} avatarPath={person.avatarUrl} />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{person.displayName}</h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {person.username ? `@${person.username}` : `${copy.idLabel}: ${person.mathgplId ?? "—"}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    School status: <span className="font-medium text-foreground">{person.status}</span>
                    {person.connectionStatus ? (
                      <>
                        {" · connection: "}
                        <span className="font-medium text-foreground">{person.connectionStatus}</span>
                      </>
                    ) : null}
                  </p>
                  <Link
                    to={kind === "teachers" ? "/school/teachers/$userId" : "/school/students/$userId"}
                    params={{ userId: person.userId }}
                    className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Open Shared Workspace
                  </Link>
                </article>
              ))}

            </div>
          )}
          {connectActions}
        </>
      )}
    </SchoolShell>
  );
};

export default SchoolPeoplePage;
