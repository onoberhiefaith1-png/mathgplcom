import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, DoorOpen, Loader2, Lock } from "lucide-react";

import { Link, useNavigate } from "@/lib/router-compat";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { supabase } from "@/integrations/supabase/client";
import { connectedOwner, connectedSchoolByOrg, enterWorkspace } from "@/lib/student/workspaceAccess";
import { money } from "@/lib/gateway/items";
import { loadGatewayByHandle } from "@/lib/gateway/gateway";

/**
 * The identity gateway.
 *
 * A student arriving through My Schools or My Teachers meets that owner's own
 * building first — visual proof of whose workspace this is — and one way in.
 * Entering is the moment the gateway decides: free workspaces open at once, a
 * paid workspace shows its plans and stays shut until payment clears.
 */
const WorkspaceEntryPage = ({ kind, id }: { kind: "school" | "teacher"; id: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [blocked, setBlocked] = useState(false);

  const owner = useQuery({
    queryKey: ["student-workspace-owner", kind, id],
    queryFn: () => (kind === "school" ? connectedSchoolByOrg(id) : connectedOwner(id)),
  });

  const ownerId = owner.data?.ownerId ?? null;

  const gateway = useQuery({
    queryKey: ["student-workspace-gateway", ownerId ?? ""],
    enabled: Boolean(ownerId) && blocked,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", ownerId!)
        .maybeSingle();
      const handle = (profile as { username?: string | null } | null)?.username ?? null;
      const view = handle ? await loadGatewayByHandle(handle) : null;
      return { handle, view };
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
      setBlocked(true);
    },
  });

  const name = owner.data?.name ?? (kind === "school" ? "School" : "Teacher");
  const paidPlans = (gateway.data?.view?.plans ?? []).filter((plan) => Number(plan.price ?? 0) > 0);

  return (
    <>
      <RotatingAdventureScene
        interactive={false}
        {...(ownerId ? { ownerUserId: ownerId } : {})}
      />

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
        <h1 className="mt-2 max-w-[22ch] text-3xl font-semibold text-foreground drop-shadow-lg sm:text-4xl">
          {owner.isLoading ? "…" : name}
        </h1>
      </div>

      <div className="fixed inset-x-0 bottom-10 z-50 grid justify-items-center px-5">
        {owner.isLoading ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-5 py-3 text-sm backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening…
          </span>
        ) : !owner.data ? (
          <p className="max-w-md rounded-2xl border border-border/60 bg-background/85 p-5 text-center text-sm text-muted-foreground backdrop-blur">
            You are not connected to this workspace yet. Ask them to connect with you, or answer their request from
            {" "}
            <Link to="/requests" className="text-primary underline">Requests</Link>.
          </p>
        ) : blocked ? (
          <section className="w-full max-w-lg rounded-2xl border border-amber-300/50 bg-background/90 p-5 text-left backdrop-blur">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
              <Lock className="h-4 w-4" /> Choose your plan
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {name} asks for a plan before their classes open. Your learning stays locked until the payment clears.
            </p>
            {gateway.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading plans…</p>
            ) : paidPlans.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No plan is available to pick yet. Ask {name} to publish one.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {paidPlans.map((plan) => (
                  <li
                    key={plan.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{plan.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{plan.description}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">{money(plan.price, plan.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            {gateway.data?.handle && (
              <Link
                to={`/g/${gateway.data.handle}`}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/15 px-5 text-sm font-medium text-amber-100 transition hover:bg-amber-500/25"
              >
                Open {name}'s gateway
              </Link>
            )}
          </section>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  );
};

export default WorkspaceEntryPage;
