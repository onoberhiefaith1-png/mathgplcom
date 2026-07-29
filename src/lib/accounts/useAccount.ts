import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Capability } from "./roles";

export type AccountState = {
  userId: string | null;
  role: AppRole | null;
  orgId: string | null;
  capabilities: Capability[];
};

const EMPTY: AccountState = { userId: null, role: null, orgId: null, capabilities: [] };

/**
 * Resolves the signed-in account: its role, the organization that owns it and
 * the capabilities that role grants. `ensure_account` self-heals accounts that
 * predate the role system (they become teachers with their own workspace).
 */
export async function loadAccount(requestedRole?: string): Promise<AccountState> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return EMPTY;

  const { data: ensured } = await supabase.rpc("ensure_account", {
    _requested_role: requestedRole ?? (user.user_metadata?.account_role as string) ?? "teacher",
    _org_name: (user.user_metadata?.organization_name as string) ?? null,
  });

  const row = Array.isArray(ensured) ? ensured[0] : ensured;
  const role = (row?.role ?? null) as AppRole | null;
  const orgId = (row?.org_id ?? null) as string | null;

  let capabilities: Capability[] = [];
  if (role) {
    const { data: caps } = await supabase
      .from("role_capabilities")
      .select("capability")
      .eq("role", role);
    capabilities = ((caps ?? []) as { capability: string }[]).map((c) => c.capability as Capability);
  }

  return { userId: user.id, role, orgId, capabilities };
}

export function useAccount() {
  const query = useQuery({
    queryKey: ["account"],
    queryFn: () => loadAccount(),
    staleTime: 5 * 60 * 1000,
  });

  const account = query.data ?? EMPTY;
  const can = (capability: Capability) => account.capabilities.includes(capability);

  return { ...account, can, isLoading: query.isLoading, refetch: query.refetch };
}
