import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Capability } from "./roles";

export type AccountState = {
  userId: string | null;
  role: AppRole | null;
  orgId: string | null;
  capabilities: Capability[];
  /** Every role granted to this account, not just the active one. */
  roles: AppRole[];
  /** True when the account owns the platform, whatever role it is viewing as. */
  isPlatformOwner: boolean;
  /** Signed in, but the account has no stored account type. */
  roleMissing: boolean;
};

const EMPTY: AccountState = {
  userId: null,
  role: null,
  orgId: null,
  capabilities: [],
  roles: [],
  isPlatformOwner: false,
  roleMissing: false,
};

/**
 * Resolves the signed-in account: its role, the organization that owns it and
 * the capabilities that role grants.
 *
 * The role is authoritative: it comes from the stored role record only. The
 * client never proposes a role (no "teacher" fallback), so entering a page or
 * a workspace can never change what kind of account this is. `ensure_account`
 * only fills in a missing profile and workspace for the role already stored.
 */
export async function loadAccount(requestedRole?: string): Promise<AccountState> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return EMPTY;

  const { data: ensured } = await supabase.rpc("ensure_account", {
    _requested_role: requestedRole ?? undefined,
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

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role as AppRole);

  return {
    userId: user.id,
    role,
    orgId,
    capabilities,
    roles,
    isPlatformOwner: roles.includes("platform_owner"),
  };
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
