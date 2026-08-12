import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { credits, money } from "@/lib/costs/categories";
import { sellPrice } from "@/lib/pricing/sellPrice";
import {
  fetchCreditInventory,
  fetchCurrencyRates,
  fetchPricingEngine,
  fetchPricingHistory,
  saveCurrencyRate,
  saveProfitPercentage,
} from "@/lib/costs/costs.functions";

const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";

/**
 * The two global inputs of the whole economy — cost per credit and profit
 * percentage — with every other credit figure derived from them. Internal
 * economics is GBP only; nothing here is customer-facing.
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

  const [costDraft, setCostDraft] = useState("");
  const [profitDraft, setProfitDraft] = useState("");

  const base = engine.data?.base;
  const inv = inventory.data?.inventory;

  const cost = Number(costDraft || (base?.costPrice ?? 0));
  const pct = Number(profitDraft || (base?.profitPercentage ?? 0));
  const derived = sellPrice(Number.isFinite(cost) ? cost : 0, Number.isFinite(pct) ? pct : 0);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["pricing-engine"] });
    void qc.invalidateQueries({ queryKey: ["pricing-history"] });
    void qc.invalidateQueries({ queryKey: ["currency-rates"] });
    void qc.invalidateQueries({ queryKey: ["cost-overview"] });
    void qc.invalidateQueries({ queryKey: ["plan-dashboard"] });
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

  return (
    <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-dash-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Global credit economics</h2>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
        These are the only two numbers set by hand. Everything else — the credit sell price, the credits included in a
        plan, pay-as-you-go pack prices — is calculated from them. All internal economics is in pounds. Changes apply to
        new subscriptions and renewals only; every active subscription stays locked to the terms it was bought on.
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
          <p className={label}>Credit sell price · derived</p>
          <p className="mt-2 text-2xl font-semibold text-dash-gold">{money(derived, "GBP")}</p>
          <p className="mt-1 text-xs text-dash-surface/60">
            {money(Number.isFinite(cost) ? cost : 0, "GBP")} × (1 + {Number.isFinite(pct) ? pct : 0}% )
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-dash-surface/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Credits purchased", credits(inv?.purchased ?? 0), money((inv?.purchased ?? 0) * derived, "GBP")],
          ["Credits used", credits(inv?.consumed ?? 0), money((inv?.consumed ?? 0) * derived, "GBP")],
          ["Credits remaining", credits(inv?.remaining ?? 0), money((inv?.remaining ?? 0) * derived, "GBP")],
          ["Upstream spend", money(inv?.spend ?? 0, "GBP"), `Average ${money(inv?.averageUnitCost ?? 0, "GBP")} / credit`],
        ].map(([k, v, hint]) => (
          <div key={k} className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
            <p className={label}>{k}</p>
            <p className="mt-1 text-lg font-semibold text-dash-surface">{v}</p>
            <p className="mt-1 text-xs text-dash-surface/55">{hint}</p>
          </div>
        ))}
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
          <p className={label}>Profit percentage history</p>
          {(pricing.data?.rows ?? []).length === 0 ? (
            <p className="text-xs text-dash-surface/55">No percentage change recorded yet.</p>
          ) : (
            (pricing.data?.rows ?? []).slice(0, 6).map((v) => (
              <p key={v.id} className="text-xs text-dash-surface/70">
                <span className={v.current ? "text-dash-gold" : ""}>{v.profitPercentage}%</span> from{" "}
                {new Date(v.effectiveFrom).toLocaleDateString("en-GB")}
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
                  from {new Date(r.effectiveFrom).toLocaleDateString("en-GB")}
                  {r.current ? " — current" : ""}
                </p>
              ))
          )}
        </div>
      </div>
    </section>
  );
}
