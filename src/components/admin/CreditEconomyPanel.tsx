import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Package, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { credits, money } from "@/lib/costs/categories";
import { AUDIENCE_LABEL, includedCredits, planTotal, SUBSCRIBING_AUDIENCES } from "@/lib/costs/pricing";
import {
  fetchCreditInventory,
  fetchPricingEngine,
  fetchStaffCodes,
  saveCreditPurchase,
  saveCurrencyPricing,
  savePlanPricing,
  saveStaffCodeFn,
} from "@/lib/costs/costs.functions";

const card = "rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5";
const heading = "text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent";
const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";

/**
 * The platform's own credit economy: credits bought upstream, the price they
 * are sold at, the plans derived from that price, and staff entitlement.
 * Nothing here is a customer-facing figure.
 */
export default function CreditEconomyPanel() {
  const qc = useQueryClient();

  const inventory = useQuery({ queryKey: ["credit-inventory"], queryFn: () => fetchCreditInventory({}) });
  const engine = useQuery({ queryKey: ["pricing-engine"], queryFn: () => fetchPricingEngine({}) });
  const staff = useQuery({ queryKey: ["staff-codes"], queryFn: () => fetchStaffCodes({}) });

  const [purchase, setPurchase] = useState({ credits: "", unitCost: "", note: "" });
  const [currencyDraft, setCurrencyDraft] = useState<Record<string, { value: string; pct: string; follows: boolean }>>({});
  const [newCurrency, setNewCurrency] = useState({ currency: "", value: "", pct: "" });
  const [planDraft, setPlanDraft] = useState<Record<string, { sub: string; credit: string }>>({});
  const [codeDraft, setCodeDraft] = useState({ code: "", label: "", entitlement: "pro" });

  const base = engine.data?.base;
  const inv = inventory.data?.inventory;

  const addPurchase = useMutation({
    mutationFn: (input: { credits: number; unitCost: number; note?: string }) =>
      saveCreditPurchase({ data: input }),
    onSuccess: () => {
      setPurchase({ credits: "", unitCost: "", note: "" });
      qc.invalidateQueries({ queryKey: ["credit-inventory"] });
      toast.success("Credit purchase recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCurrency = useMutation({
    mutationFn: (input: {
      currency: string;
      creditValue: number;
      profitPercentage: number | null;
      followsBase: boolean;
    }) => saveCurrencyPricing({ data: input }),
    onSuccess: () => {
      setNewCurrency({ currency: "", value: "", pct: "" });
      qc.invalidateQueries({ queryKey: ["pricing-engine"] });
      qc.invalidateQueries({ queryKey: ["currency-rates"] });
      toast.success("Pricing saved as a new version.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePlan = useMutation({
    mutationFn: (input: { key: string; subscriptionAmount: number; creditAmount: number }) =>
      savePlanPricing({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-engine"] });
      toast.success("Plan updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCode = useMutation({
    mutationFn: (input: { code: string; label?: string; entitlement: string; active: boolean }) =>
      saveStaffCodeFn({ data: input }),
    onSuccess: () => {
      setCodeDraft({ code: "", label: "", entitlement: "pro" });
      qc.invalidateQueries({ queryKey: ["staff-codes"] });
      toast.success("Staff code saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const plansByAudience = useMemo(() => {
    const rows = engine.data?.plans ?? [];
    return SUBSCRIBING_AUDIENCES.map((audience) => ({
      audience,
      plans: rows.filter((p) => p.audience === audience),
    }));
  }, [engine.data?.plans]);

  return (
    <div className="space-y-4">
      {/* Inventory */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Platform credit inventory</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Credits bought upstream are the platform's stock and its real cost. Consumption is read from metered usage, so
          the remaining balance is measured, never estimated.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Purchased", credits(inv?.purchased ?? 0)],
            ["Consumed", credits(inv?.consumed ?? 0)],
            ["Remaining", credits(inv?.remaining ?? 0)],
            ["Upstream spend", money(inv?.spend ?? 0)],
            ["Average cost / credit", money(inv?.averageUnitCost ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-3">
              <p className={label}>{k}</p>
              <p className="mt-1 text-lg font-semibold text-dash-surface">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-dash-surface/10 pt-4">
          <div>
            <p className={label}>Credits bought</p>
            <Input
              inputMode="decimal"
              className="mt-1 h-9 w-32"
              placeholder="1000"
              value={purchase.credits}
              onChange={(e) => setPurchase({ ...purchase, credits: e.target.value })}
            />
          </div>
          <div>
            <p className={label}>Cost per credit</p>
            <Input
              inputMode="decimal"
              className="mt-1 h-9 w-28"
              placeholder="0.31"
              value={purchase.unitCost}
              onChange={(e) => setPurchase({ ...purchase, unitCost: e.target.value })}
            />
          </div>
          <div className="min-w-48 flex-1">
            <p className={label}>Note</p>
            <Input
              className="mt-1 h-9"
              placeholder="Invoice reference"
              value={purchase.note}
              onChange={(e) => setPurchase({ ...purchase, note: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={addPurchase.isPending}
            onClick={() => {
              const c = Number(purchase.credits);
              const u = Number(purchase.unitCost);
              if (!(c > 0) || !Number.isFinite(u)) return toast.error("Enter the credits bought and their cost.");
              addPurchase.mutate({ credits: c, unitCost: u, note: purchase.note || undefined });
            }}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> Record purchase
          </Button>
        </div>

        {(inv?.purchases ?? []).length > 0 && (
          <div className="mt-4 space-y-1 border-t border-dash-surface/10 pt-3">
            {(inv?.purchases ?? []).slice(0, 6).map((p) => (
              <p key={p.id} className="text-xs text-dash-surface/70">
                {new Date(p.purchasedAt).toLocaleDateString("en-GB")} — {credits(p.credits)} at{" "}
                {money(p.unitCost, p.currency)} each = {money(p.credits * p.unitCost, p.currency)}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Pricing engine */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Credit pricing engine</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Cost price + profit percentage = the sell price of one credit. GBP is the base. A currency either follows the
          base percentage automatically or holds its own; every save is a new version, so past periods keep their rate.
        </p>

        {base && (
          <p className="mt-3 text-sm text-dash-surface/80">
            Base now: {money(base.costPrice)} cost + {base.profitPercentage}% ={" "}
            <span className="font-semibold text-dash-gold">{money(base.sellPrice)}</span> per credit
          </p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left ${label}`}>
                <th className="pb-2">Currency</th>
                <th className="pb-2">Cost / credit</th>
                <th className="pb-2">Profit %</th>
                <th className="pb-2">Controlled by GBP</th>
                <th className="pb-2">Sell price</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {(engine.data?.currencies ?? []).map((c) => {
                const draft = currencyDraft[c.currency] ?? {
                  value: String(c.creditValue),
                  pct: String(c.profitPercentage),
                  follows: c.followsBase,
                };
                const set = (patch: Partial<typeof draft>) =>
                  setCurrencyDraft((d) => ({ ...d, [c.currency]: { ...draft, ...patch } }));
                const effectivePct = draft.follows ? (base?.profitPercentage ?? 0) : Number(draft.pct);
                const preview = Number(draft.value) * (1 + (Number.isFinite(effectivePct) ? effectivePct : 0) / 100);
                return (
                  <tr key={c.currency} className="border-t border-dash-surface/10">
                    <td className="py-2 font-semibold text-dash-surface">{c.currency}</td>
                    <td className="py-2">
                      <Input
                        className="h-8 w-24"
                        inputMode="decimal"
                        value={draft.value}
                        onChange={(e) => set({ value: e.target.value })}
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        className="h-8 w-20"
                        inputMode="decimal"
                        disabled={draft.follows}
                        value={draft.follows ? String(base?.profitPercentage ?? "") : draft.pct}
                        onChange={(e) => set({ pct: e.target.value })}
                      />
                    </td>
                    <td className="py-2">
                      <Switch
                        checked={draft.follows}
                        onCheckedChange={(v) => set({ follows: v })}
                        disabled={c.currency === "GBP"}
                      />
                    </td>
                    <td className="py-2 text-dash-surface/80">{money(preview, c.currency)}</td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const value = Number(draft.value);
                          if (!Number.isFinite(value)) return toast.error("Enter the cost per credit.");
                          saveCurrency.mutate({
                            currency: c.currency,
                            creditValue: value,
                            profitPercentage: draft.follows ? null : Number(draft.pct),
                            followsBase: c.currency === "GBP" ? true : draft.follows,
                          });
                        }}
                      >
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-dash-surface/10 pt-4">
          <div>
            <p className={label}>Add currency</p>
            <Input
              className="mt-1 h-9 w-24"
              placeholder="USD"
              value={newCurrency.currency}
              onChange={(e) => setNewCurrency({ ...newCurrency, currency: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <p className={label}>Cost / credit</p>
            <Input
              className="mt-1 h-9 w-28"
              inputMode="decimal"
              placeholder="0.40"
              value={newCurrency.value}
              onChange={(e) => setNewCurrency({ ...newCurrency, value: e.target.value })}
            />
          </div>
          <div>
            <p className={label}>Profit % (blank follows GBP)</p>
            <Input
              className="mt-1 h-9 w-28"
              inputMode="decimal"
              value={newCurrency.pct}
              onChange={(e) => setNewCurrency({ ...newCurrency, pct: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={saveCurrency.isPending}
            onClick={() => {
              const value = Number(newCurrency.value);
              if (newCurrency.currency.length < 3 || !Number.isFinite(value))
                return toast.error("Enter a currency code and cost per credit.");
              const follows = newCurrency.pct.trim() === "";
              saveCurrency.mutate({
                currency: newCurrency.currency,
                creditValue: value,
                profitPercentage: follows ? null : Number(newCurrency.pct),
                followsBase: follows,
              });
            }}
          >
            Add
          </Button>
        </div>
      </section>

      {/* Plans */}
      <section className={card}>
        <h2 className={heading}>Plans</h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          A plan is a subscription amount plus a credit value. The credits included are derived from the live sell price,
          so a percentage change moves them everywhere. Students never subscribe — access comes through their school or
          teacher.
        </p>

        <div className="mt-4 space-y-5">
          {plansByAudience.map(({ audience, plans }) => (
            <div key={audience}>
              <p className={label}>{AUDIENCE_LABEL[audience]}</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left ${label}`}>
                      <th className="pb-2">Plan</th>
                      <th className="pb-2">Subscription</th>
                      <th className="pb-2">Credit value</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">Credits included</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => {
                      const draft = planDraft[p.key] ?? {
                        sub: String(p.subscriptionAmount),
                        credit: String(p.creditAmount),
                      };
                      const set = (patch: Partial<typeof draft>) =>
                        setPlanDraft((d) => ({ ...d, [p.key]: { ...draft, ...patch } }));
                      const sub = Number(draft.sub) || 0;
                      const creditValue = Number(draft.credit) || 0;
                      const included = includedCredits(
                        creditValue,
                        base?.costPrice ?? 0,
                        base?.profitPercentage ?? 0,
                      );
                      return (
                        <tr key={p.key} className="border-t border-dash-surface/10">
                          <td className="py-2 text-dash-surface">
                            {p.label}
                            {p.status === "coming_soon" && (
                              <span className="ml-2 rounded-full border border-dash-surface/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-dash-surface/60">
                                Coming soon
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <Input
                              className="h-8 w-24"
                              inputMode="decimal"
                              value={draft.sub}
                              onChange={(e) => set({ sub: e.target.value })}
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              className="h-8 w-24"
                              inputMode="decimal"
                              value={draft.credit}
                              onChange={(e) => set({ credit: e.target.value })}
                            />
                          </td>
                          <td className="py-2 text-dash-surface/80">
                            {money(planTotal({ subscriptionAmount: sub, creditAmount: creditValue }), p.currency)}
                          </td>
                          <td className="py-2 text-dash-surface/80">{credits(included)}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                savePlan.mutate({
                                  key: p.key,
                                  subscriptionAmount: sub,
                                  creditAmount: creditValue,
                                })
                              }
                            >
                              Save
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Staff codes */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Staff access codes</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Staff access is not a promotion. A staff code grants entitlement with no checkout, and the usage it creates is
          still recorded at full platform cost so it reads as a measured internal expense.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <p className={label}>Code</p>
            <Input
              className="mt-1 h-9 w-40"
              placeholder="MATHGPL-STAFF"
              value={codeDraft.code}
              onChange={(e) => setCodeDraft({ ...codeDraft, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="min-w-40 flex-1">
            <p className={label}>Label</p>
            <Input
              className="mt-1 h-9"
              placeholder="Internal team"
              value={codeDraft.label}
              onChange={(e) => setCodeDraft({ ...codeDraft, label: e.target.value })}
            />
          </div>
          <div>
            <p className={label}>Entitlement</p>
            <Input
              className="mt-1 h-9 w-28"
              value={codeDraft.entitlement}
              onChange={(e) => setCodeDraft({ ...codeDraft, entitlement: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={saveCode.isPending}
            onClick={() => {
              if (codeDraft.code.trim().length < 2) return toast.error("Enter a code.");
              saveCode.mutate({
                code: codeDraft.code,
                label: codeDraft.label || undefined,
                entitlement: codeDraft.entitlement || "pro",
                active: true,
              });
            }}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save code
          </Button>
        </div>

        <div className="mt-4 space-y-2 border-t border-dash-surface/10 pt-3">
          {(staff.data?.rows ?? []).length === 0 ? (
            <p className="text-xs text-dash-surface/55">No staff code created yet.</p>
          ) : (
            (staff.data?.rows ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-dash-surface">
                  <span className="font-mono">{c.code}</span>
                  <span className="ml-2 text-xs text-dash-surface/65">
                    {c.label ?? "Staff"} · {c.entitlement} · {c.redemptions} in use
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dash-surface/60">{c.active ? "Active" : "Disabled"}</span>
                  <Switch
                    checked={c.active}
                    onCheckedChange={(v) =>
                      saveCode.mutate({
                        code: c.code,
                        label: c.label ?? undefined,
                        entitlement: c.entitlement,
                        active: v,
                      })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
