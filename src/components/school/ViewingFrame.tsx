/**
 * The frame around a Shared Workspace being viewed read-only.
 *
 * It adds nothing but a thin identity strip: below it, the teacher's own pages
 * render unchanged. Every write inside is refused by `ViewAsProvider`.
 */
import type { ReactNode } from "react";
import { Eye, Loader2 } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { ViewAsProvider } from "@/lib/accounts/viewAs";
import { useSharedMember } from "@/lib/accounts/useSharedMember";

const ViewingFrame = ({ userId, children }: { userId: string; children: ReactNode }) => {
  const { orgId, person, overview } = useSharedMember(userId);

  if (!orgId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          Switch to your school to open its Shared Workspaces.
        </p>
      </main>
    );
  }

  if (overview.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening shared workspace…
      </main>
    );
  }

  const name = person?.displayName ?? "this teacher";

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs backdrop-blur">
        <span className="inline-flex items-center gap-2 text-amber-100">
          <Eye className="h-3.5 w-3.5" />
          Viewing <strong className="font-semibold">{name}</strong>&rsquo;s workspace — view only. Only {name} can edit.
        </span>
        <Link
          to={`/school/teachers/${userId}`}
          className="rounded-full border border-amber-300/40 px-3 py-1 text-amber-100 hover:bg-amber-400/20"
        >
          Shared workspace
        </Link>
      </div>
      <ViewAsProvider
        ownerId={userId}
        orgId={orgId}
        personName={person?.displayName ?? null}
        basePath={`/school/teachers/${userId}`}
      >
        {children}
      </ViewAsProvider>
    </div>
  );
};

export default ViewingFrame;
