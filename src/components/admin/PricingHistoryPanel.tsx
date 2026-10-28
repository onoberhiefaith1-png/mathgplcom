import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { money } from "@/lib/costs/categories";
import { fetchPricingHistory } from "@/lib/costs/costs.functions";

const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";

const stamp = (v: string) =>
  new Date(v).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Locked pricing history in a fixed-height container: three records visible,
 * everything older reachable by scrolling inside the panel. Nothing is deleted —
 * live subscriptions and credit lots still point at these versions.
 */
export default function PricingHistoryPanel() {
  const [expanded, setExpanded] = useState(false);
  const pricing = useQuery({ queryKey: ["pricing-history"], queryFn: () => fetchPricingHistory({}) });
  const rows = pricing.data?.rows ?? [];
  const visible = expanded ? rows : rows.slice(0, 3);

  return (
    <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-dash-surface/70" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-surface/80">
            Pricing version history
          </h2>
        </div>
        {rows.length > 3 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-dash-surface/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-dash-surface/75 transition hover:bg-dash-surface/10"
          >
            {expanded ? "Show latest 3" : `View all history (${rows.length})`}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-dash-surface/60">
        Newest first. Each version is locked: the sell price shown is derived from the cost and profit recorded at that
        time, never from today's inputs. Changing an input creates a new version and leaves these untouched.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-dash-surface/55">No pricing version recorded yet.</p>
      ) : (
        <div className="mt-3 max-h-[15rem] space-y-2 overflow-y-auto pr-1">
          {visible.map((v) => (
            <div
              key={v.id}
              className={`rounded-xl border p-3 ${
                v.current ? "border-dash-gold/40 bg-dash-gold/5" : "border-dash-surface/12 bg-dash-surface/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-dash-surface">{v.label ?? "Pricing version"}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    v.current ? "bg-dash-gold/20 text-dash-gold" : "bg-dash-surface/10 text-dash-surface/60"
                  }`}
                >
                  {v.current ? "Current rate" : "Locked"}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-dash-surface/70 sm:grid-cols-4">
                <p>
                  <span className={label}>Cost / credit</span>
                  <br />
                  {money(v.costPerCredit, "GBP")}
                </p>
                <p>
                  <span className={label}>Profit</span>
                  <br />
                  {v.profitPercentage}%
                </p>
                <p>
                  <span className={label}>Sell price</span>
                  <br />
                  {money(v.sellPrice, "GBP")}
                </p>
                <p>
                  <span className={label}>Effective from</span>
                  <br />
                  {stamp(v.effectiveFrom)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
