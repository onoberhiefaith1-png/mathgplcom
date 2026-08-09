import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export type AccountIdentity = {
  mathgplId: string;
  role: string;
  prefix: string;
  acronym: string | null;
};

const ACCOUNT_TYPE: Record<string, string> = {
  platform_owner: "Administrator",
  co_admin: "Administrator",
  school: "School",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export const accountTypeLabel = (role?: string | null) =>
  (role && ACCOUNT_TYPE[role]) || "Account";

/** The signed-in person's permanent MathGPL ID. */
export const useMathgplId = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["mathgpl-id", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AccountIdentity | null> => {
      const { data, error } = await supabase
        .from("account_ids")
        .select("mathgpl_id, role, prefix, acronym")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        mathgplId: data.mathgpl_id,
        role: data.role,
        prefix: data.prefix,
        acronym: data.acronym,
      };
    },
  });
  return {
    identity: query.data ?? null,
    mathgplId: query.data?.mathgplId ?? null,
    typeLabel: accountTypeLabel(query.data?.role),
    loading: query.isLoading,
  };
};
