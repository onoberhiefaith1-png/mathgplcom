import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Loader2, Radio, Sparkles } from "lucide-react";

import SharedWorkspaceShell from "@/components/school/SharedWorkspaceShell";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { fetchSharedClasses } from "@/lib/accounts/sharedWorkspace";

/** Which class board the school wants to watch. Watching never interrupts. */
const SharedSmartboardPage = ({ userId }: { userId: string }) => {
  const { orgId, person } = useSharedMember(userId);

  const classes = useQuery({
    queryKey: ["shared-classes", orgId, userId],
    queryFn: async () => fetchSharedClasses(orgId!, userId),
    enabled: Boolean(orgId),
  });

  return (
    <SharedWorkspaceShell
      userId={userId}
      person={person}
      section="smartboard"
      title="Smartboard"
      subtitle="Open a class to watch the board the teacher is teaching on. The school observes; it never writes on the board."
    >
      {!orgId ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      ) : classes.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading boards…
        </p>
      ) : (classes.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          The teacher has no classes in this school yet, so there is no board to watch.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(classes.data ?? []).map((c) => (
            <li key={c.id}>
              <Link
                to={`/school/teachers/${userId}/smartboard/${c.id}`}
                className="block h-full rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/60 hover:bg-card"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold">{c.name}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Radio className="h-3.5 w-3.5" /> {c.boardOpen ? "Board open to the class" : "Board not shared yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SharedWorkspaceShell>
  );
};

export default SharedSmartboardPage;
