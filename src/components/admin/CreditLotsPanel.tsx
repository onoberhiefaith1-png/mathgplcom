import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";

import { credits, money } from "@/lib/costs/categories";
import { fetchCreditLots } from "@/lib/costs/costs.functions";
import { useAdminLiveRefresh } from "@/hooks/useAdminLiveRefresh";

const th = "py-1.5 pr-4 text-left font-semibold uppercase tracking-[0.1em] text-dash-surface/55";

const stamp = (v: string) =>
  new Date(v).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  exhausted: "bg-dash-surface/10 text-dash-surface/60",
  expired: "bg-rose-500/15 text-rose-300",
};

/**
 * Credit lots, newest first. Each lot is locked to the economics it was bought
 * under; consumption always walks the oldest lot first (FIFO), so the bottom of
 * this list is spent before the top.
 */
export default function CreditLotsPanel() {
  useAdminLiveRefresh(["credit-lots"]);
  const lots = useQuery({ queryKey: ["credit-lots"], queryFn: () => fetchCreditLots({ data: {} }) });
  const rows = lots.data?.rows ?? [];

  return (
    <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-dash-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Credit lots</h2>
        </div>
        {lots.isFetching ? <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" /> : null}
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
        Credits are shown in credits; money paid is shown in pounds. Each lot keeps the cost, profit percentage and sell
        price that applied at purchase — a later change to the current economics never reprices a lot. Credits are
        consumed first in, first out, and a single usage event may span two lots.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-dash-surface/55">No credit lot recorded yet.</p>
      ) : (
        <div className="mt-3 max-h-[22rem] overflow-auto">
          <table className="w-full min-w-[880px] text-xs">
            <thead>
              <tr className="border-b border-dash-surface/10">
                <th className={th}>Purchased</th>
                <th className={th}>Account</th>
                <th className={th}>Credits</th>
                <th className={th}>Paid (GBP)</th>
                <th className={th}>Locked cost</th>
                <th className={th}>Locked profit</th>
                <th className={th}>Locked sell price</th>
                <th className={th}>Consumed</th>
                <th className={th}>Remaining</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="text-dash-surface/75">
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-dash-surface/10">
                  <td className="py-1.5 pr-4 whitespace-nowrap">{stamp(l.grantedAt)}</td>
                  <td className="py-1.5 pr-4">{l.owner}</td>
                  <td className="py-1.5 pr-4">{credits(l.creditsPurchased)}</td>
                  <td className="py-1.5 pr-4">
                    {l.amountPaid === null ? (
                      <span className="text-dash-surface/45">no payment recorded</span>
                    ) : (
                      money(l.amountPaid, l.currency)
                    )}
                  </td>
                  {l.rateRecorded ? (
                    <>
                      <td className="py-1.5 pr-4">{money(l.costPerCredit ?? 0, "GBP")}</td>
                      <td className="py-1.5 pr-4">{l.profitPercentage ?? 0}%</td>
                      <td className="py-1.5 pr-4">{money(l.sellPrice ?? 0, "GBP")}</td>
                    </>
                  ) : (
                    <td className="py-1.5 pr-4 text-dash-surface/45" colSpan={3}>
                      rate not recorded
                    </td>
                  )}
                  <td className="py-1.5 pr-4">{credits(l.creditsConsumed)}</td>
                  <td className="py-1.5 pr-4">{credits(l.creditsRemaining)}</td>
                  <td className="py-1.5 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        STATUS[l.status] ?? STATUS.exhausted
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
