import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, DoorOpen, Loader2 } from "lucide-react";

import { Link, useNavigate } from "@/lib/router-compat";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { supabase } from "@/integrations/supabase/client";
import { connectedOwner, connectedSchoolByOrg, enterWorkspace } from "@/lib/student/workspaceAccess";
import { loadGatewayByHandle, loadMyEntitlement } from "@/lib/gateway/gateway";
import WorkspacePlanGate from "@/pages/student/WorkspacePlanGate";

/**
 * The way into a school's or a teacher's workspace.
 *
 * The gateway comes first: a student picks the plan that owner published — the
 * free one included — and only then meets the building, which is nothing more
 * than that owner's identity and a single way in.
 */
const WorkspaceEntryPage = ({ kind, id }: { kind: "school" | "teacher"; id: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkoutState =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("checkout") : null;

  const owner = useQuery({
    queryKey: ["student-workspace-owner", kind, id],
    queryFn: () => (kind === "school" ? connectedSchoolByOrg(id) : connectedOwner(id)),
  });

  const ownerId = owner.data?.ownerId ?? null;

  /** That owner's published plans, and where this student stands with them. */
  const gate = useQuery({
    queryKey: ["student-workspace-gate", ownerId ?? ""],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", ownerId!)
        .maybeSingle();
      const handle = (profile as { username?: string | null } | null)?.username ?? null;
      const [view, entitlement] = await Promise.all([
        handle ? loadGatewayByHandle(handle) : Promise.resolve(null),
        loadMyEntitlement(ownerId!),
      ]);
      return { handle, view, entitlement };
    },
  });

  const enter = useMutation({
    mutationFn: async () => {
      if (!owner.data) throw new Error("not_connected");
      return enterWorkspace(owner.data.ownerId, owner.data.orgId);
    },
    onSuccess: async (result) => {
      if (result === "granted") {
        await queryClient.invalidateQueries({ queryKey: ["student-learning"] });
        navigate(kind === "school" ? `/student/schools/${id}/dashboard` : `/student/teachers/${id}/dashboard`);
        return;
      }
      // Payment or plan still outstanding — back to the plan page.
      await gate.refetch();
    },
  });

  const name = owner.data?.name ?? (kind === "school" ? "School" : "Teacher");

  if (owner.isLoading || (owner.data && gate.isLoading)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!owner.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <p className="max-w-md text-sm text-muted-foreground">
          You are not connected to this workspace yet. Ask them to connect with you, or answer their request from{" "}
          <Link to="/requests" className="text-primary underline">
            Requests
          </Link>
          .
        </p>
      </main>
    );
  }

  const view = gate.data?.view ?? null;
  const activePlan = gate.data?.entitlement?.status === "active";

  // The gateway stands in front of the building whenever this owner published
  // plans and the student has not chosen one yet.
  if (view && view.plans.length > 0 && !activePlan) {
    return (
      <WorkspacePlanGate
        view={view}
        kind={kind}
        ownerName={name}
        checkoutState={checkoutState}
        onChosen={() => {
          void gate.refetch();
        }}
      />
    );
  }

  return (
    <>
      <RotatingAdventureScene interactive={false} {...(ownerId ? { ownerUserId: ownerId } : {})} />

      <Link
        to="/student"
        aria-label="Back to my dashboard"
        className="fixed left-5 top-5 z-50 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 text-sm backdrop-blur transition hover:border-primary/50"
      >
        <ArrowLeft className="h-4 w-4" /> My Dashboard
      </Link>

      <div className="pointer-events-none fixed inset-x-0 top-24 z-40 grid place-items-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {kind === "school" ? "School workspace" : "Teacher workspace"}
        </p>
        <h1 className="mt-2 max-w-[22ch] text-3xl font-semibold text-foreground drop-shadow-lg sm:text-4xl">{name}</h1>
      </div>

      <div className="fixed inset-x-0 bottom-10 z-50 grid justify-items-center px-5">
        <button
          type="button"
          onClick={() => enter.mutate()}
          disabled={enter.isPending}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-amber-300/60 bg-background/85 px-8 text-base font-semibold text-amber-200 shadow-[0_0_32px_hsl(40_90%_60%/0.35)] backdrop-blur transition hover:bg-amber-500/25 disabled:opacity-60"
        >
          {enter.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <DoorOpen className="h-5 w-5" />}
          Enter {name}
        </button>
        {enter.isError && (
          <p className="mt-3 rounded-xl border border-destructive/50 bg-background/85 px-4 py-2 text-sm text-destructive backdrop-blur">
            That did not work. Please try again.
          </p>
        )}
      </div>
    </>
  );
};

export default WorkspaceEntryPage;
