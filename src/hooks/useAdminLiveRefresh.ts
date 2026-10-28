import { useTableChanges } from "@/lib/stability/useTableChanges";
import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";


// Internal cost/profit rows (usage_events) are deliberately not streamed live —
// they never leave the admin-only read path — so money screens also refresh on
// a short interval to stay current.
const TABLES = ["credit_ledger", "credit_purchases", "payment_transactions", "credit_wallets"] as const;
const REFRESH_MS = 20000;

/**
 * Admin money screens refresh themselves. Anything that changes the financial
 * position — usage, a deduction, a purchase, a payment — invalidates the given
 * query keys, so no figure is ever a stale cache.
 */
export function useAdminLiveRefresh(keys: string[]) {
  const qc = useQueryClient();

  const keyList = keys.join("-");
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const refresh = useCallback(() => {
    for (const key of keysRef.current) void qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);

  useTableChanges({
    name: `admin-live-${keyList}`,
    watch: TABLES.map((table) => ({ table })),
    onChange: refresh,
  });

  useEffect(() => {
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);
}
