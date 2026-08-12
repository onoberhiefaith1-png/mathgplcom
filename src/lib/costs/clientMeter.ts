import { useEffect, useRef } from "react";
import { reportUsage } from "./costs.functions";

/** Bytes → GB, the unit the storage price book is written in. */
export const bytesToGb = (bytes: number) => bytes / 1_073_741_824;

/** Fire-and-forget; accounting must never block a user action. */
export function meterClientUsage(
  metric: "storage.gb_month" | "realtime.minutes" | "realtime.messages" | "network.egress_gb" | "database.rows_written",
  quantity: number,
  feature: string,
  unit = "unit",
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return;
  void reportUsage({ data: { metric, quantity, unit, feature } }).catch(() => {});
}

/** Reports how long a realtime channel stayed open, in minutes. */
export function useRealtimeMeter(feature: string, active = true) {
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    return () => {
      const started = startedAt.current;
      startedAt.current = null;
      if (!started) return;
      const minutes = (Date.now() - started) / 60_000;
      if (minutes >= 0.1) meterClientUsage("realtime.minutes", minutes, feature, "minute");
    };
  }, [feature, active]);
}
