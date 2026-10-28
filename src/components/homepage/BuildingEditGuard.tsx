import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

import { useWorkspace } from "@/lib/accounts/useWorkspace";

/**
 * The Building belongs to whoever owns the workspace.
 *
 * Inside a Personal Workspace that is the person themselves; inside a Shared
 * Workspace it is the school. A connected teacher operates the Teaching Hub
 * there, so the building editors are simply not available to them.
 */
const BuildingEditGuard = ({ children }: { children: ReactNode }) => {
  const { active, isLoading } = useWorkspace();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the building…
        </p>
      </main>
    );
  }

  if (active && !active.isOwner) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-xl place-items-center px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">The Building here belongs to {active.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are working inside a Shared Workspace. {active.name} decides how its building looks; your teaching
            content is yours. Switch to your Personal Workspace to design your own building.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the building
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
};

export default BuildingEditGuard;
