import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useResolvedBuilding } from "@/lib/homepage/useResolvedBuilding";

/**
 * The building editors are only for people who may change a building: an
 * admin, a pro teacher in their own workspace, or a school. Students and free
 * accounts never see them. The database refuses the same writes.
 */
const BuildingEditGuard = ({ children }: { children: ReactNode }) => {
  const { role } = useAccount();
  const { active, isLoading: workspaceLoading } = useWorkspace();
  const resolved = useResolvedBuilding();

  if (workspaceLoading || resolved.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the building…
        </p>
      </main>
    );
  }

  if (!resolved.canChange) {
    const student = role === "student";
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-xl place-items-center px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">
            {student ? "Students cannot change the building" : "This building cannot be changed"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {student
              ? "The building shows whose workspace you are in. It is chosen by that school, that teacher, or Mathemagine."
              : active && !active.isOwner
                ? `${active.name} decides how its building looks. Your teaching content is yours.`
                : "A free account uses Mathemagine’s Free building. Choosing a building is part of a Pro teacher or school workspace."}
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
