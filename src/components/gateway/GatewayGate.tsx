import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { loadGatewayByHandle, loadMyEntitlement } from "@/lib/gateway/gateway";
import type { GatewayItem } from "@/lib/gateway/items";

/**
 * The gate in front of a teacher's or school's content.
 *
 * It only intervenes when that owner has actually published gateway plans. An
 * owner who never opened Pricing has no gateway, so nothing changes for their
 * students — the gate stays out of the way.
 */
const GatewayGate = ({
  ownerId,
  item,
  children,
}: {
  ownerId: string | null | undefined;
  item?: GatewayItem;
  children: ReactNode;
}) => {
  const gate = useQuery({
    queryKey: ["gateway-gate", ownerId ?? "", item ?? "all"],
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", ownerId!)
        .maybeSingle();
      const handle = profile?.username ?? null;
      const view = handle ? await loadGatewayByHandle(handle) : null;
      if (!view || view.plans.length === 0) return { open: true as const, handle };
      const entitlement = await loadMyEntitlement(ownerId!);
      const active = entitlement?.status === "active";
      const allowed = active && (!item || entitlement!.grantedItems.includes(item));
      return {
        open: Boolean(allowed),
        handle,
        ownerName: view.ownerName,
        awaitingPayment: entitlement?.status === "pending_payment",
      };
    },
  });

  if (!ownerId) return <>{children}</>;

  if (gate.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (gate.data?.open !== false) return <>{children}</>;

  return (
    <div className="grid min-h-[50vh] place-items-center px-6 py-12 text-center">
      <div className="max-w-md space-y-4">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Lock className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold">
          {gate.data.awaitingPayment ? "Waiting for your plan to start" : "Choose your plan first"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {gate.data.awaitingPayment
            ? `${gate.data.ownerName ?? "Your teacher"} will confirm your plan shortly.`
            : `${gate.data.ownerName ?? "Your teacher"} offers this through their plans.`}
        </p>
        {gate.data.handle ? (
          <Link
            to={`/g/${gate.data.handle}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            See the plans
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default GatewayGate;
