import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { credits, money } from "@/lib/costs/categories";
import { sellPrice } from "@/lib/pricing/sellPrice";
import {
  fetchCreditInventory,
  fetchCurrencyRates,
  fetchLockedRatePeriods,
  fetchPricingEngine,
  fetchPricingHistory,
  saveCurrencyRate,
  saveProfitPercentage,
} from "@/lib/costs/costs.functions";

const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";
const day = (v: string) => new Date(v).toLocaleDateString("en-GB");

/**
 * Two blocks, deliberately separated:
 *
 *  CURRENT — the only two editable numbers, plus the sell price derived from
 *  them. Applies to new subscriptions, renewals and future usage.
 *
 *  LOCKED HISTORY — money figures read from the rate stored on each record.
 *  Nothing here is ever recalculated from the current inputs.
 */
export default function GlobalCreditEconomics({
  locked = [],
}: {
  locked?: { rate: number; count: number }[];
}) {
  const qc = useQueryClient();
  const engine = useQuery({ queryKey: ["pricing-engine"], queryFn: () => fetchPricingEngine({}) });
  const inventory = useQuery({ queryKey: ["credit-inventory"], queryFn: () => fetchCreditInventory({}) });
  const pricing = useQuery({ queryKey: ["pricing-history"], queryFn: () => fetchPricingHistory({}) });
  const rates = useQuery({ queryKey: ["currency-rates"], queryFn: () => fetchCurrencyRates({}) });
  const periods = useQuery({ queryKey: ["locked-rate-periods"], queryFn: () => fetchLockedRatePeriods({}) });

  const [costDraft, setCostDraft] = useState("");
  const [profitDraft, setProfitDraft] = useState("");

  const base = engine.data?.base;
  const inv = inventory.data?.inventory;

  const cost = Number(costDraft || (base?.costPrice ?? 0));
  const pct = Number(profitDraft || (base?.profitPercentage ?? 0));
  const derived = sellPrice(Number.isFinite(cost) ? cost : 0, Number.isFinite(pct) ? pct : 0);
  const previewing = Boolean(costDraft || profitDraft);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["pricing-engine"] });
    void qc.invalidateQueries({ queryKey: ["pricing-history"] });
    void qc.invalidateQueries({ queryKey: ["currency-rates"] });
    void qc.invalidateQueries({ queryKey: ["cost-overview"] });
    void qc.invalidateQueries({ queryKey: ["plan-dashboard"] });
    void qc.invalidateQueries({ queryKey: ["plan-catalogue"] });
    void qc.invalidateQueries({ queryKey: ["pricing-pipeline"] });
    void qc.invalidateQueries({ queryKey: ["locked-rate-periods"] });
    void qc.invalidateQueries({ queryKey: ["credit-inventory"] });
  };

  const saveCost = useMutation({
    mutationFn: (value: number) => saveCurrencyRate({ data: { currency: "GBP", creditValue: value } }),
    onSuccess: () => {
      setCostDraft("");
      invalidate();
      toast.success("Cost per credit saved as a new version. Past transactions keep their own rate.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfit = useMutation({
    mutationFn: (value: number) => saveProfitPercentage({ data: { value } }),
    onSuccess: () => {
      setProfitDraft("");
      invalidate();
      toast.success("Profit percentage saved. Active subscriptions keep the rate they started on.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const periodRows = periods.data?.rows ?? [];

  return (
    <div className="space-y-6">
      {/* ───────────── Current economics ───────────── */}
      <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-dash-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Current economics</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          These are the only two numbers set by hand. The credit sell price, the credits included in a plan, pack prices,
          the pricing pipeline and the public pricing page are all calculated from them, in pounds. A change applies to
          new subscriptions, renewals and future usage only — every active subscription stays locked to the terms it was
          bought on, and no past record is ever repriced.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Cost per credit · input</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-dash-surface/70">£</span>
              <Input
                inputMode="decimal"
                className="h-9 w-24"
                placeholder="0.30"
                value={costDraft || String(base?.costPrice ?? "")}
                onChange={(e) => setCostDraft(e.target.value)}
              />
              <Button
                size="sm"
                disabled={saveCost.isPending}
                onClick={() => {
                  const value = Number(costDraft || base?.costPrice);
                  if (!Number.isFinite(value) || value < 0) return toast.error("Enter the cost of one credit.");
                  saveCost.mutate(value);
                }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Profit percentage · input</p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                inputMode="decimal"
                className="h-9 w-24"
                placeholder="40"
                value={profitDraft || String(base?.profitPercentage ?? "")}
                onChange={(e) => setProfitDraft(e.target.value)}
              />
              <span className="text-sm text-dash-surface/70">%</span>
              <Button
                size="sm"
                disabled={saveProfit.isPending}
                onClick={() => {
                  const value = Number(profitDraft || base?.profitPercentage);
                  if (!Number.isFinite(value) || value < 0) return toast.error("Enter a percentage.");
                  saveProfit.mutate(value);
                }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-dash-gold/30 bg-dash-gold/5 p-3">
            <p className={label}>Credit sell price · {previewing ? "preview" : "derived"}</p>
            <p className="mt-2 text-2xl font-semibold text-dash-gold">{money(derived, "GBP")}</p>
            <p className="mt-1 text-xs text-dash-surface/60">
              {money(Number.isFinite(cost) ? cost : 0, "GBP")} × (1 + {Number.isFinite(pct) ? pct : 0}% )
            </p>
            {previewing ? (
              <p className="mt-1 text-[11px] text-dash-gold/80">Preview only — press Save to make this the live rate.</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-dash-surface/10 pt-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className={label}>Locked rates in force</p>
            {locked.length === 0 ? (
              <p className="text-xs text-dash-surface/55">No paid subscriptions yet.</p>
            ) : (
              locked.map((l) => (
                <p key={l.rate} className="text-xs text-dash-surface/70">
                  {l.rate}% — {l.count} subscription{l.count === 1 ? "" : "s"}
                </p>
              ))
            )}
          </div>

          <div className="space-y-1">
            <p className={label}>Pricing version history</p>
            {(pricing.data?.rows ?? []).length === 0 ? (
              <p className="text-xs text-dash-surface/55">No percentage change recorded yet.</p>
            ) : (
              (pricing.data?.rows ?? []).slice(0, 6).map((v) => (
                <p key={v.id} className="text-xs text-dash-surface/70">
                  <span className={v.current ? "text-dash-gold" : ""}>{v.label ?? "PV"}</span> — cost £
                  {v.costPerCredit.toFixed(4)} + {v.profitPercentage}% = £{v.sellPrice.toFixed(4)} from{" "}
                  {day(v.effectiveFrom)}
                  {v.current ? " — current" : ""}
                </p>
              ))
            )}
          </div>


          <div className="space-y-1">
            <p className={label}>Cost per credit history</p>
            {(rates.data?.rows ?? []).length === 0 ? (
              <p className="text-xs text-dash-surface/55">No rate recorded yet.</p>
            ) : (
              (rates.data?.rows ?? [])
                .filter((r) => r.currency === "GBP")
                .slice(0, 6)
                .map((r) => (
                  <p key={r.id} className="text-xs text-dash-surface/70">
                    <span className={r.current ? "text-dash-gold" : ""}>1 credit = {money(r.creditValue, "GBP")}</span>{" "}
                    from {day(r.effectiveFrom)}
                    {r.current ? " — current" : ""}
                  </p>
                ))
            )}
          </div>
        </div>
      </section>

      {/* ───────────── Locked history ───────────── */}
      <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-dash-surface/70" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-surface/80">Locked history</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Read-only. Every amount below is the amount recorded at the time, using the cost and profit rate stored on that
          record. Changing the current economics above never moves a figure here.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Credits purchased</p>
            <p className="mt-1 text-lg font-semibold text-dash-surface">{credits(inv?.purchased ?? 0)}</p>
            <p className="mt-1 text-xs text-dash-surface/55">Recorded spend {money(inv?.spend ?? 0, "GBP")}</p>
          </div>
          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Credits used</p>
            <p className="mt-1 text-lg font-semibold text-dash-surface">{credits(inv?.consumed ?? 0)}</p>
            <p className="mt-1 text-xs text-dash-surface/55">Recorded cost {money(inv?.consumedCost ?? 0, "GBP")}</p>
          </div>
          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Credits remaining</p>
            <p className="mt-1 text-lg font-semibold text-dash-surface">{credits(inv?.remaining ?? 0)}</p>
            <p className="mt-1 text-xs text-dash-surface/55">Balance in credits — no single historical rate applies</p>
          </div>
          <div className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>Average purchase cost</p>
            <p className="mt-1 text-lg font-semibold text-dash-surface">
              {money(inv?.averageUnitCost ?? 0, "GBP")}
            </p>
            <p className="mt-1 text-xs text-dash-surface/55">Per credit, across recorded invoices</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto border-t border-dash-surface/10 pt-4">
          <p className={label}>Rate periods usage was recorded under</p>
          {periodRows.length === 0 ? (
            <p className="mt-2 text-xs text-dash-surface/55">No usage recorded yet.</p>
          ) : (
            <table className="mt-2 w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-dash-surface/55">
                  <th className="py-1.5 pr-4 font-semibold uppercase tracking-[0.1em]">Period</th>
                  <th className="py-1.5 pr-4 font-semibold uppercase tracking-[0.1em]">Cost</th>
                  <th className="py-1.5 pr-4 font-semibold uppercase tracking-[0.1em]">Profit</th>
                  <th className="py-1.5 pr-4 font-semibold uppercase tracking-[0.1em]">Sell price</th>
                  <th className="py-1.5 pr-4 font-semibold uppercase tracking-[0.1em]">Credits</th>
                  <th className="py-1.5 font-semibold uppercase tracking-[0.1em]">Recorded cost</th>
                </tr>
              </thead>
              <tbody className="text-dash-surface/75">
                {periodRows.map((p) => (
                  <tr
                    key={`${p.costPrice}-${p.profitPercentage}`}
                    className="border-t border-dash-surface/10"
                  >
                    <td className="py-1.5 pr-4">
                      {day(p.firstAt)} → {day(p.lastAt)}
                    </td>
                    <td className="py-1.5 pr-4">{money(p.costPrice, "GBP")}</td>
                    <td className="py-1.5 pr-4">{p.profitPercentage}%</td>
                    <td className="py-1.5 pr-4">{money(p.sellPrice, "GBP")}</td>
                    <td className="py-1.5 pr-4">{credits(p.credits)}</td>
                    <td className="py-1.5">{money(p.recordedCost, "GBP")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
