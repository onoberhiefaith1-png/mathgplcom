import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcademiaTier } from "@/lib/academia/tiers";
import { isTier } from "@/lib/academia/tiers";
import {
  DEFAULT_TIER_METADATA_KEY,
  readDefaultTier,
  subscribeDefaultTier,
  writeDefaultTier,
} from "@/lib/academia/tierPreference";

/**
 * The learner's default tier (§4). Device-stored for an instant, offline-safe
 * read. `account: true` (website only) also mirrors it to the signed-in
 * MathGPL account so it follows the learner. Mathemagine keeps it on the
 * device and never touches the MathGPL login (separate auth by design).
 */
export function useDefaultTier(opts: { account?: boolean } = {}) {
  const tier = useSyncExternalStore(subscribeDefaultTier, readDefaultTier, () => "beginner" as AcademiaTier);
  const account = !!opts.account;

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      const saved = data.session?.user?.user_metadata?.[DEFAULT_TIER_METADATA_KEY];
      if (!cancelled && isTier(saved) && saved !== readDefaultTier()) writeDefaultTier(saved);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [account]);

  const setTier = useCallback((next: AcademiaTier) => {
    writeDefaultTier(next);
    if (!account) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return; // guests keep it on this device
      return supabase.auth.updateUser({ data: { [DEFAULT_TIER_METADATA_KEY]: next } });
    }).catch(() => undefined);
  }, [account]);

  return { tier, setTier } as const;
}
