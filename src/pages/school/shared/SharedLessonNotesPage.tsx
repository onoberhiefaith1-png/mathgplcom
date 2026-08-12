import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { BookOpen, Loader2 } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedNotes } from "@/lib/accounts/sharedWorkspace";

/** The teacher's lesson notes inside this school — readable, never editable. */
const SharedLessonNotesPage = ({ userId }: { userId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const notes = useQuery({
    queryKey: ["shared-notes", orgId, userId],
    queryFn: async () => fetchSharedNotes(orgId!, userId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="lesson-notes"
      title="Lesson Notes"
      subtitle="Lesson notes the teacher created inside this school. Open one to read it; creating and editing stays with the teacher."
    >
      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : notes.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lesson notes…
        </p>
      ) : (notes.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          No lesson notes in this shared workspace yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(notes.data ?? []).map((n) => (
            <li key={n.id}>
              <Link
                to={`/school/teachers/${userId}/lesson-notes/${n.id}`}
                className="block h-full rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/60 hover:bg-card"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <BookOpen className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[n.subject, n.subtopic].filter(Boolean).join(" · ") || "No topic set"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {n.className ? `Class: ${n.className}` : "Not tied to a class"}
                  {n.updatedAt ? ` · updated ${new Date(n.updatedAt).toLocaleDateString()}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedLessonNotesPage;
