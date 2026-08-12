import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABEL, RANGES, money, type CostCategory, type RangeKey } from "@/lib/costs/categories";
import { fetchCostUnitDetail } from "@/lib/costs/costs.functions";
import {

  fetchAccountOptions,
  fetchPromoCodes,
  fetchRevenueLedger,
  grantAccountCredits,
  recordUsagePayment,
  savePromoCodeFn,
} from "@/lib/costs/usage.functions";


const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const STATUSES = ["all", "paid", "discounted", "unpaid", "free", "staff"] as const;

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  discounted: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  unpaid: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  free: "bg-slate-500/15 text-slate-300 border-slate-400/30",
  staff: "bg-amber-500/15 text-amber-300 border-amber-400/30",
};

const Card = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) => (
  <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-surface/60">{label}</p>
    <p
      className={`mt-2 text-2xl font-semibold ${
        tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-dash-surface"
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-1 text-xs text-dash-surface/55">{hint}</p>}
  </div>
);

export default function CostRevenueAnalysis() {
  const qc = useQueryClient();
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [costUnitId, setCostUnitId] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const [promoDraft, setPromoDraft] = useState({ code: "", kind: "discount", discountPercentage: "20", label: "" });

  const { from, to } = useMemo(() => {
    if (rangeKey === "custom") return { from: `${customFrom}T00:00:00Z`, to: `${customTo}T23:59:59Z` };
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
    return { from: new Date(Date.now() - days * 86_400_000).toISOString(), to: new Date().toISOString() };
  }, [rangeKey, customFrom, customTo]);

  const ledger = useQuery({
    queryKey: ["revenue-ledger", from, to, status, query, costUnitId],
    queryFn: () => fetchRevenueLedger({ data: { from, to, status, query, ...(costUnitId ? { costUnitId } : {}) } }),
  });
  const accounts = useQuery({
    queryKey: ["revenue-accounts", from, to],
    queryFn: () => fetchAccountOptions({ data: { from, to } }),
  });
  const promos = useQuery({ queryKey: ["promo-codes"], queryFn: () => fetchPromoCodes({}) });
  const subscription = useQuery({
    queryKey: ["cost-unit-subscriptions", costUnitId, from, to],
    queryFn: () => fetchCostUnitDetail({ data: { from, to, costUnitId: costUnitId! } }),
    enabled: !!costUnitId,
  });


  const grant = useMutation({
    mutationFn: (input: { costUnitId: string; amount: number }) =>
      grantAccountCredits({ data: { ...input, note: "Administrator credit grant" } }),
    onSuccess: (r) => {
      toast.success(`New balance ${money(r.balance, currency)}.`);
      setCreditAmount("");
      void qc.invalidateQueries({ queryKey: ["revenue-accounts"] });
      void qc.invalidateQueries({ queryKey: ["usage-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payment = useMutation({
    mutationFn: (input: { costUnitId: string; amount: number }) => recordUsagePayment({ data: input }),
    onSuccess: (r) => {
      toast.success(`Applied to ${r.applied} usage line${r.applied === 1 ? "" : "s"}.`);
      setPaymentAmount("");
      void qc.invalidateQueries({ queryKey: ["revenue-ledger"] });
      void qc.invalidateQueries({ queryKey: ["revenue-accounts"] });
      void qc.invalidateQueries({ queryKey: ["usage-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const savePromo = useMutation({
    mutationFn: () =>
      savePromoCodeFn({
        data: {
          code: promoDraft.code,
          kind: promoDraft.kind as "discount" | "staff",
          discountPercentage: Number(promoDraft.discountPercentage || 0),
          label: promoDraft.label || undefined,
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Code saved.");
      setPromoDraft({ code: "", kind: "discount", discountPercentage: "20", label: "" });
      void qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currency = ledger.data?.currency ?? "GBP";
  const summary = ledger.data?.summary;
  const rows = ledger.data?.rows ?? [];
  const detail = rows.find((r) => r.id === open);
  const selectedAccount = accounts.data?.rows.find((a) => a.costUnitId === costUnitId);

  return (
    <DashboardShell
      title="Usage & Revenue Analysis"
      subtitle="Every metered event with its stored actual cost, Percentage Profit, customer charge and payment result. Each row keeps the percentage locked to that customer's subscription — changing the global percentage never rewrites history."
      actions={
        <Link
          to="/admin/usage-analytics"
          className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface transition hover:bg-dash-surface/20"
        >
          Usage analytics
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <section className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                rangeKey === r.key
                  ? "border-dash-gold bg-dash-gold/15 text-dash-gold"
                  : "border-dash-surface/20 text-dash-surface/70 hover:bg-dash-surface/10"
              }`}
            >
              {r.label}
            </button>
          ))}
          {rangeKey === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36" />
              <span className="text-xs text-dash-surface/60">to</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-36" />
            </div>
          )}
          <span className="h-5 w-px bg-dash-surface/20" />
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                status === s
                  ? "border-dash-gold bg-dash-gold/15 text-dash-gold"
                  : "border-dash-surface/20 text-dash-surface/70 hover:bg-dash-surface/10"
              }`}
            >
              {s}
            </button>
          ))}
          {ledger.isFetching && <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" />}
        </section>

        {/* Financial summary */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Card label="Actual cost" value={money(summary?.cost ?? 0, currency)} />
          <Card label="Expected charge" value={money(summary?.charge ?? 0, currency)} />
          <Card label="Collected" value={money(summary?.paid ?? 0, currency)} />
          <Card label="Expected profit" value={money(summary?.expectedProfit ?? 0, currency)} hint="Charge − cost, before payment" />

          <Card
            label="Financial result"
            value={money(summary?.result ?? 0, currency)}
            tone={(summary?.result ?? 0) >= 0 ? "good" : "bad"}
            hint="Collected − cost, unpaid shown as exposure"
          />
          <Card
            label="Unpaid exposure"
            value={money(summary?.unpaidExposure ?? 0, currency)}
            tone={(summary?.unpaidExposure ?? 0) > 0 ? "bad" : undefined}
            hint={`Free subsidy ${money(summary?.freeSubsidy ?? 0, currency)}`}
          />
        </section>

        {/* Status breakdown */}
        {summary && summary.byStatus.length > 0 && (
          <section className="flex flex-wrap gap-2">
            {summary.byStatus.map((s) => (
              <span
                key={s.status}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLE[s.status] ?? STATUS_STYLE.free}`}
              >
                {s.status}: {s.events} · charge {money(s.charge, currency)} · collected {money(s.paid, currency)}
              </span>
            ))}
          </section>
        )}

        {/* Locked subscription pricing for the selected account */}
        {costUnitId && (
          <section className="rounded-2xl border border-dash-gold/25 bg-dash-gold/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-gold">Subscription pricing</h2>
            <p className="mt-1 text-xs text-dash-surface/65">
              {selectedAccount ? `${selectedAccount.name} — ${selectedAccount.code}. ` : ""}
              The Percentage Profit below was locked when the period started, so a later global change never alters it.
            </p>
            {(subscription.data?.detail.subscriptions ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-dash-surface/60">
                No subscription recorded. Usage is charged at the percentage in force when each event was metered.
              </p>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-dash-surface/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dash-surface/10 text-dash-surface/70">
                    <tr>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2 text-right">Percentage Profit</th>
                      <th className="px-3 py-2 text-right">Credit price</th>
                      <th className="px-3 py-2 text-right">Discount</th>
                      <th className="px-3 py-2 text-right">Price paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(subscription.data?.detail.subscriptions ?? []).map((s) => (
                      <tr key={s.id} className="border-t border-dash-surface/10">
                        <td className="px-3 py-2 text-dash-surface">{s.plan}</td>
                        <td className="px-3 py-2 capitalize text-dash-surface/75">{s.status}</td>
                        <td className="px-3 py-2 text-dash-surface/70">
                          {new Date(s.periodStart).toLocaleDateString("en-GB")} →{" "}
                          {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-GB") : "open"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-dash-gold">{s.lockedRate}%</td>
                        <td className="px-3 py-2 text-right text-dash-surface/75">{money(s.creditPrice, s.currency)}</td>
                        <td className="px-3 py-2 text-right text-dash-surface/75">{s.discountPercentage}%</td>
                        <td className="px-3 py-2 text-right text-dash-surface">{money(s.finalPrice, s.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}



        {/* Ledger */}
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Accounting ledger</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-surface/50" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search account, activity or model"
                  className="h-9 w-64 pl-9"
                />
              </div>
              <select
                value={costUnitId ?? ""}
                onChange={(e) => setCostUnitId(e.target.value || undefined)}
                className="h-9 rounded-md border border-dash-surface/20 bg-dash-surface/10 px-3 text-xs text-dash-surface"
              >
                <option value="">All accounts</option>
                {(accounts.data?.rows ?? []).map((a) => (
                  <option key={a.costUnitId} value={a.costUnitId}>
                    {a.name} — {a.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 max-h-[30rem] overflow-auto rounded-xl border border-dash-surface/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-dash-surface/10 text-dash-surface/70">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">Percentage Profit</th>
                  <th className="px-3 py-2 text-right">Charge</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                    className="cursor-pointer border-t border-dash-surface/10 transition hover:bg-dash-surface/10"
                  >
                    <td className="px-3 py-2 text-dash-surface/70">{new Date(r.occurredAt).toLocaleString("en-GB")}</td>
                    <td className="px-3 py-2 text-dash-surface">{r.owner}</td>
                    <td className="px-3 py-2 text-dash-surface/80">{r.resource}</td>
                    <td className="px-3 py-2 text-dash-surface/60">{CATEGORY_LABEL[r.category as CostCategory]}</td>
                    <td className="px-3 py-2 text-right text-dash-surface/80">{money(r.cost, currency)}</td>
                    <td className="px-3 py-2 text-right text-dash-surface/80">{r.profitRate}%</td>
                    <td className="px-3 py-2 text-right text-dash-surface">{money(r.charge, currency)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                          STATUS_STYLE[r.status] ?? STATUS_STYLE.free
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${r.result >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {money(r.result, currency)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-5 text-center text-dash-surface/60">
                      No metered transactions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {detail && (
            <div className="mt-4 rounded-xl border border-dash-gold/30 bg-dash-gold/5 p-4 text-xs text-dash-surface/80">
              <p className="text-sm font-semibold text-dash-surface">{detail.resource}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <p>Account: <span className="text-dash-surface">{detail.owner}</span> ({detail.ownerCode})</p>
                <p>Metric: <span className="text-dash-surface">{detail.metric}</span></p>
                <p>Quantity: <span className="text-dash-surface">{detail.quantity} {detail.unit}</span></p>
                <p>Model: <span className="text-dash-surface">{detail.model ?? "—"}</span></p>
                <p>Actual cost: <span className="text-dash-surface">{money(detail.cost, currency)}</span></p>
                <p>Percentage Profit: <span className="text-dash-surface">{detail.profitRate}%</span> (locked to their subscription)</p>
                <p>Profit at that percentage: <span className="text-dash-surface">{money(detail.profitAmount, currency)}</span></p>
                <p>Expected charge: <span className="text-dash-surface">{money(detail.charge, currency)}</span></p>
                <p>Collected: <span className="text-dash-surface">{money(detail.amountPaid, currency)}</span></p>
                <p>Discount: <span className="text-dash-surface">{detail.discount}%</span> {detail.promoCode ?? ""}</p>
                <p>Status: <span className="capitalize text-dash-surface">{detail.status}</span></p>
                <p>Unpaid exposure: <span className="text-dash-surface">{money(Math.max(detail.charge - detail.amountPaid, 0), currency)}</span></p>
                <p>Result: <span className={detail.result >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(detail.result, currency)}</span></p>

              </div>
            </div>
          )}
        </section>

        {/* Credits + codes */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Credit balances</h2>
            <p className="mt-1 text-xs text-dash-surface/60">
              Chargeable usage is deducted from the account's balance as it happens. When the balance runs out the event is
              recorded as unpaid and further generation is blocked.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={costUnitId ?? ""}
                onChange={(e) => setCostUnitId(e.target.value || undefined)}
                className="h-9 flex-1 rounded-md border border-dash-surface/20 bg-dash-surface/10 px-3 text-xs text-dash-surface"
              >
                <option value="">Select an account</option>
                {(accounts.data?.rows ?? []).map((a) => (
                  <option key={a.costUnitId} value={a.costUnitId}>
                    {a.name} — {money(a.balance, currency)}
                  </option>
                ))}
              </select>
              <Input
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Amount"
                className="h-9 w-28"
              />
              <Button
                size="sm"
                disabled={!costUnitId || !creditAmount || grant.isPending}
                onClick={() => grant.mutate({ costUnitId: costUnitId!, amount: Number(creditAmount) })}
              >
                {grant.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                Add credits
              </Button>
            </div>
            <div className="mt-4 border-t border-dash-surface/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/70">Record a payment</p>
              <p className="mt-1 text-xs text-dash-surface/60">
                Money received is applied to this account's unpaid usage, oldest first — each settled line turns from a
                loss into profit.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount received"
                  className="h-9 w-40"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!costUnitId || !paymentAmount || payment.isPending}
                  onClick={() => payment.mutate({ costUnitId: costUnitId!, amount: Number(paymentAmount) })}
                >
                  {payment.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Apply payment
                </Button>
              </div>
            </div>
            {selectedAccount && (
              <p className="mt-2 text-xs text-dash-surface/70">
                {selectedAccount.name} balance: {money(selectedAccount.balance, currency)}
              </p>
            )}
          </div>


          <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Promo &amp; staff codes</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={promoDraft.code}
                onChange={(e) => setPromoDraft({ ...promoDraft, code: e.target.value })}
                placeholder="CODE"
                className="h-9 w-28"
              />
              <select
                value={promoDraft.kind}
                onChange={(e) => setPromoDraft({ ...promoDraft, kind: e.target.value })}
                className="h-9 rounded-md border border-dash-surface/20 bg-dash-surface/10 px-3 text-xs text-dash-surface"
              >
                <option value="discount">Discount</option>
                <option value="staff">Staff / internal</option>
              </select>
              {promoDraft.kind === "discount" && (
                <Input
                  value={promoDraft.discountPercentage}
                  onChange={(e) => setPromoDraft({ ...promoDraft, discountPercentage: e.target.value })}
                  placeholder="%"
                  className="h-9 w-20"
                />
              )}
              <Input
                value={promoDraft.label}
                onChange={(e) => setPromoDraft({ ...promoDraft, label: e.target.value })}
                placeholder="Label"
                className="h-9 flex-1"
              />
              <Button size="sm" disabled={!promoDraft.code || savePromo.isPending} onClick={() => savePromo.mutate()}>
                {savePromo.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {(promos.data?.rows ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-dash-surface/10 px-3 py-2 text-xs">
                  <span className="font-mono text-dash-surface">{p.code}</span>
                  <span className="capitalize text-dash-surface/70">{p.kind}</span>
                  <span className="text-dash-surface/70">{p.kind === "staff" ? "No charge" : `${p.discountPercentage}% off`}</span>
                  <span className="text-dash-surface/60">{p.redemptions} redeemed</span>
                  <span className={p.active ? "text-emerald-300" : "text-rose-300"}>{p.active ? "Active" : "Off"}</span>
                </div>
              ))}
              {promos.data && promos.data.rows.length === 0 && (
                <p className="text-xs text-dash-surface/60">No codes yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
