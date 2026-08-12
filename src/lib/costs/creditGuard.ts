import { supabase } from "@/integrations/supabase/client";

/**
 * Blocks chargeable generation when a paying account has run out of credits.
 * Free accounts, staff codes and accounts without a paid subscription are
 * never blocked — they simply accrue platform cost.
 */
export async function hasCreditsForGeneration(estimated = 0.05): Promise<boolean> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data, error } = await supabase.rpc("can_afford_usage", {
    _user_id: userId,
    _org_id: (profile?.active_org_id ?? null) as unknown as string,
    _estimated: estimated,
  });
  if (error) return true; // Accounting must never break a lesson.
  return data !== false;
}

export const INSUFFICIENT_CREDITS_MESSAGE =
  "You have run out of credits. Top up your balance to keep generating.";
