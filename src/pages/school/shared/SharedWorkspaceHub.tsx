import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Eye, Loader2 } from "lucide-react";

import SharedWorkspaceShell, { SHARED_SECTIONS } from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedCounts } from "@/lib/accounts/sharedWorkspace";

/**
 * The school's entry point into a connected teacher's Shared Workspace.
 *
 * It shows the same five Teaching Hub sections the teacher operates — Lesson
 * Notes, Smartboard, Classes, Adventure, Skill Builder — in view mode. Students,
 * assignments and progress are not sections: they live inside Classes, exactly
 * where the teacher keeps them.
 */
const SharedWorkspaceHub = ({ userId }: { userId: string }) => {
  const { orgId, person, overview } = useSharedMember(userId);

  const counts = useQuery({
    queryKey: ["shared-counts", orgId, userId],
    queryFn: async () => fetchSharedCounts(orgId!, userId),
    enabled: Boolean(orgId),
  });

  const countFor = (key: string) => {
    if (!counts.data) return null;
    if (key === "lesson-notes") return `${counts.data.notes} lesson note${counts.data.notes === 1 ? "" : "s"}`;
    if (key === "classes") return `${counts.data.classes} class${counts.data.classes === 1 ? "" : "es"}`;
    if (key === "adventure") return `${counts.data.adventures} adventure${counts.data.adventures === 1 ? "" : "s"}`;
    if (key === "skill-builder") return `${counts.data.courses} course${counts.data.courses === 1 ? "" : "s"}`;
    return "Live teaching mirror";
  };

  const blurb: Record<string, string> = {
    "lesson-notes": "Every lesson note this teacher created in this school. Open one to read it exactly as authored.",
    smartboard: "Watch the board this teacher is teaching on, live. Viewing never interrupts the lesson.",
    classes: "The teacher's classes — and inside each one, its students, assignments, adventures and progress.",
    adventure: "Adventures built inside this school, with their scenes.",
    "skill-builder": "Courses this teacher built here, with their sections.",
  };

  if (!orgId) {
    return (
      <SharedWorkspaceShell userId={userId} person={null} section="hub">
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      </SharedWorkspaceShell>
    );
  }

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="hub"
      subtitle="This is the school–teacher Shared Workspace, not the teacher's Personal Workspace. You can open and review everything the teacher created here; only the teacher can create or change it. The Building belongs to the school and is edited from the School Console."
    >
      {overview.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening shared workspace…
        </p>
      ) : !person ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          This person is not connected to your school.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHARED_SECTIONS.map(({ key, label, icon: Icon, path }) => (
            <Link
              key={key}
              to={`/school/teachers/${userId}/${path}`}
              className="group rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/60 hover:bg-card"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-lg font-semibold">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{blurb[key]}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-200">
                <Eye className="h-3.5 w-3.5" /> {countFor(key) ?? "View"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedWorkspaceHub;
