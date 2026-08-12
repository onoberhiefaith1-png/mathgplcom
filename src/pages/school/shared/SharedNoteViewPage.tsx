import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import NoteReader from "@/components/lessonnotes/NoteReader";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedNote } from "@/lib/accounts/sharedWorkspace";

/** One lesson note, rendered exactly as the teacher authored it — read only. */
const SharedNoteViewPage = ({ userId, noteId }: { userId: string; noteId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const note = useQuery({
    queryKey: ["shared-note", orgId, userId, noteId],
    queryFn: async () => fetchSharedNote(orgId!, userId, noteId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="lesson-notes"
      title={note.data?.title ?? "Lesson note"}
      subtitle="Reading the teacher's note. Nothing here can be changed from the school side."
    >
      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : note.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening lesson note…
        </p>
      ) : !note.data ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          This lesson note is not part of this shared workspace.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              <Eye className="h-3.5 w-3.5" /> Read only
            </span>
            {[note.data.subject, note.data.subtopic, note.data.className, note.data.session]
              .filter(Boolean)
              .map((bit) => (
                <span key={String(bit)}>{bit}</span>
              ))}
          </div>
          <article className="rounded-2xl border border-border bg-card/70 p-6">
            <NoteReader documentJson={note.data.documentJson} />
          </article>
        </>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedNoteViewPage;
