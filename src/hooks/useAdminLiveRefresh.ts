import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const TABLES = ["usage_events", "credit_ledger", "credit_purchases", "payment_transactions", "credit_wallets"] as const;

/**
 * Admin money screens refresh themselves. Anything that changes the financial
 * position — usage, a deduction, a purchase, a payment — invalidates the given
 * query keys, so no figure is ever a stale cache.
 */
export function useAdminLiveRefresh(keys: string[]) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel(`admin-live-${keys.join("-")}`);
    const refresh = () => {
      for (const key of keys) void qc.invalidateQueries({ queryKey: [key] });
    };
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, keys.join("-")]);
}
