import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export type AccountIdentity = {
  mathgplId: string;
  role: string;
  prefix: string;
  acronym: string | null;
  /** The ID this person chose for themselves, when they have set one. */
  customId: string | null;
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
      // `custom_id` is part of the same row; the generated types catch up
      // after the chosen-ID change lands.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, string | null> | null; error: unknown }> };
          };
        };
      })
        .from("account_ids")
        .select("mathgpl_id, role, prefix, acronym, custom_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        mathgplId: data["mathgpl_id"] ?? "",
        role: data["role"] ?? "",
        prefix: data["prefix"] ?? "",
        acronym: data["acronym"] ?? null,
        customId: data["custom_id"] ?? null,
      };
    },
  });
  return {
    identity: query.data ?? null,
    mathgplId: query.data?.mathgplId ?? null,
    customId: query.data?.customId ?? null,
    /** What the person actually types to sign in. */
    signInId: query.data?.customId ?? query.data?.mathgplId ?? null,
    typeLabel: accountTypeLabel(query.data?.role),
    loading: query.isLoading,
    refetch: query.refetch,
  };
};
