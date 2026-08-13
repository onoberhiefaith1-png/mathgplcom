import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { credits, money } from "@/lib/costs/categories";
import { fetchFinancialSummary } from "@/lib/costs/usage.functions";
import { useAdminLiveRefresh } from "@/hooks/useAdminLiveRefresh";

const Figure = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "hold";
}) => (
  <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-surface/60">{label}</p>
    <p
      className={`mt-2 text-2xl font-semibold ${
        tone === "good"
          ? "text-emerald-300"
          : tone === "bad"
            ? "text-rose-300"
            : tone === "hold"
              ? "text-amber-300"
              : "text-dash-surface"
      }`}
    >
      {value}
    </p>
    {hint ? <p className="mt-1 text-xs text-dash-surface/55">{hint}</p> : null}
  </div>
);

/**
 * The financial position, with the one distinction that matters kept explicit:
 * money received for credits is a liability until those credits are consumed.
 * Profit is only ever realised at the moment of use.
 */
export default function FinancialPositionPanel({
  from,
  to,
  costUnitId,
}: {
  from: string;
  to: string;
  costUnitId?: string;
}) {
  useAdminLiveRefresh(["financial-summary"]);
  const summary = useQuery({
    queryKey: ["financial-summary", from, to, costUnitId],
    queryFn: () => fetchFinancialSummary({ data: { from, to, ...(costUnitId ? { costUnitId } : {}) } }),
  });

  const s = summary.data;
  const cur = s?.currency ?? "GBP";

  return (
    <section className="rounded-2xl border border-dash-gold/25 bg-dash-gold/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-gold">Financial position</h2>
        {summary.isFetching ? <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" /> : null}
      </div>
      <p className="mt-1 text-xs text-dash-surface/65">
        A credit purchase is prepaid value, not profit. Profit is realised only when prepaid credits are consumed.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Cash received"
          value={money(s?.cashReceived ?? 0, cur)}
          hint={`Subscriptions + credit purchases · ${credits(s?.creditsIssued ?? 0)} issued`}
        />
        <Figure
          label="Subscription revenue"
          value={money(s?.subscriptionRevenue ?? 0, cur)}
          hint="Service component — recognised on payment"
        />
        <Figure
          label="Prepaid credits outstanding"
          value={credits(s?.prepaidOutstandingCredits ?? 0)}
          tone="hold"
          hint={`Liability · ${money(s?.prepaidOutstandingValue ?? 0, cur)} at the price sold`}
        />
        <Figure
          label="Credit money held"
          value={money(s?.creditCashReceived ?? 0, cur)}
          hint="Collected for credits in this period — not yet revenue"
        />
        <Figure
          label="Realised usage revenue"
          value={money(s?.realisedUsageRevenue ?? 0, cur)}
          hint={`${credits(s?.realisedUsageCredits ?? 0)} consumed at their locked sell price`}
        />
        <Figure
          label="Underlying cost"
          value={money(s?.underlyingCost ?? 0, cur)}
          hint={`${credits(s?.underlyingCostCredits ?? 0)} of platform cost`}
        />
        <Figure
          label="Realised profit"
          value={money(s?.realisedProfit ?? 0, cur)}
          tone={(s?.realisedProfit ?? 0) >= 0 ? "good" : "bad"}
          hint="Realised usage revenue − underlying cost"
        />
        <Figure
          label="Net financial result"
          value={money(s?.netResult ?? 0, cur)}
          tone={(s?.netResult ?? 0) >= 0 ? "good" : "bad"}
          hint={`Refunds ${money(s?.refunds ?? 0, cur)} · exposure ${credits(s?.exposureCredits ?? 0)}`}
        />
      </div>
    </section>
  );
}
