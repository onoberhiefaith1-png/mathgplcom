import { useQuery } from "@tanstack/react-query";
import { Compass, Eye, Loader2 } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedAdventures } from "@/lib/accounts/sharedWorkspace";

/** Adventures built inside this school — reviewed, never edited, by the school. */
const SharedAdventurePage = ({ userId }: { userId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const adventures = useQuery({
    queryKey: ["shared-adventures", orgId, userId],
    queryFn: async () => fetchSharedAdventures(orgId!, userId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="adventure"
      title="Adventure"
      subtitle="Adventures the teacher built inside this school. The teacher stays responsible for creating and editing them."
    >
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
        <Eye className="h-3.5 w-3.5" /> View only
      </div>

      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : adventures.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading adventures…
        </p>
      ) : (adventures.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          No adventures in this shared workspace yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(adventures.data ?? []).map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card/60 p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Compass className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold">{a.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[a.topic, a.subtopic].filter(Boolean).join(" · ") || "No topic set"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {a.scenes} scene{a.scenes === 1 ? "" : "s"}
                {a.updatedAt ? ` · updated ${new Date(a.updatedAt).toLocaleDateString()}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedAdventurePage;
