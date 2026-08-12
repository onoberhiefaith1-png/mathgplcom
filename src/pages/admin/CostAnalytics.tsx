import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, RefreshCw, Save, Search } from "lucide-react";
import { toast } from "sonner";

import EmbeddableShell from "@/components/admin/EmbeddableShell";
import CreditEconomyPanel from "@/components/admin/CreditEconomyPanel";
import GlobalCreditEconomics from "@/components/admin/GlobalCreditEconomics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  COST_CATEGORIES,
  RANGES,
  money,
  type CostCategory,
  type RangeKey,
} from "@/lib/costs/categories";
import {
  fetchCostOverview,
  fetchCostUnitDetail,
  fetchPriceBook,
  fetchProfitReport,
  reconcileCosts,
  saveResourcePrice,
} from "@/lib/costs/costs.functions";


const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function useRange() {
  const [key, setKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));

  const { from, to } = useMemo(() => {
    if (key === "custom") return { from: `${customFrom}T00:00:00Z`, to: `${customTo}T23:59:59Z` };
    const days = RANGES.find((r) => r.key === key)?.days ?? 30;
    return {
      from: new Date(Date.now() - days * 86_400_000).toISOString(),
      to: new Date().toISOString(),
    };
  }, [key, customFrom, customTo]);

  return { key, setKey, from, to, customFrom, setCustomFrom, customTo, setCustomTo };
}

const Card = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-surface/60">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-dash-surface">{value}</p>
    {hint && <p className="mt-1 text-xs text-dash-surface/55">{hint}</p>}
  </div>
);

export default function CostAnalytics({ embedded }: { embedded?: boolean } = {}) {
  const range = useRange();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const args = { from: range.from, to: range.to };

  const overview = useQuery({
    queryKey: ["cost-overview", args],
    queryFn: () => fetchCostOverview({ data: args }),
  });
  const report = useQuery({
    queryKey: ["cost-report", args, query],
    queryFn: () => fetchProfitReport({ data: { ...args, query } }),
  });
  const prices = useQuery({ queryKey: ["cost-prices"], queryFn: () => fetchPriceBook({}) });

  const detail = useQuery({
    queryKey: ["cost-unit", openUnit, args],
    queryFn: () => fetchCostUnitDetail({ data: { ...args, costUnitId: openUnit! } }),
    enabled: !!openUnit,
  });

  const currency = overview.data?.currency ?? "GBP";

  const savePrice = useMutation({
    mutationFn: (input: { metric: string; unitPrice: number | null }) => saveResourcePrice({ data: input }),
    onSuccess: () => {
      toast.success("Price version saved. Run reconcile to reprice past usage.");
      void qc.invalidateQueries({ queryKey: ["cost-prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reconcile = useMutation({
    mutationFn: () => reconcileCosts({ data: { days: 90 } }),
    onSuccess: (r) => {
      toast.success(`${r.repriced} usage events repriced.`);
      void qc.invalidateQueries({ queryKey: ["cost-overview"] });
      void qc.invalidateQueries({ queryKey: ["cost-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = (overview.data?.series ?? []).map((p) => ({
    day: p.day.slice(5),
    ...p.actualCost,
    charge: p.totalCharge,
  }));

  const totals = overview.data?.totals;

  return (
    <EmbeddableShell embedded={embedded}
      title="Cost Analytics"
      subtitle="Metered platform cost, customer charge and profit — administrator-only accounting. No customer dashboard shows any of this."
      actions={
        <>
          <Link
            to="/admin/billing"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20"
          >
            Cost catalogue
          </Link>
          <Button size="sm" variant="secondary" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
            {reconcile.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
            Reconcile
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Period */}
        <section className="flex flex-wrap items-end gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => range.setKey(r.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                range.key === r.key
                  ? "border-dash-gold bg-dash-gold/15 text-dash-gold"
                  : "border-dash-surface/20 text-dash-surface/70 hover:bg-dash-surface/10"
              }`}
            >
              {r.label}
            </button>
          ))}
          {range.key === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={range.customFrom}
                onChange={(e) => range.setCustomFrom(e.target.value)}
                className="h-8 w-36"
              />
              <span className="text-xs text-dash-surface/60">to</span>
              <Input
                type="date"
                value={range.customTo}
                onChange={(e) => range.setCustomTo(e.target.value)}
                className="h-8 w-36"
              />
            </div>
          )}
        </section>

        {/* Totals */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Total cost" value={money(totals?.actual ?? 0, currency)} hint="What the platform paid" />
          <Card label="Total charge" value={money(totals?.charge ?? 0, currency)} hint="Cost + locked profit rate" />
          <Card label="Profit" value={money(totals?.profit ?? 0, currency)} />
          <Card label="Margin" value={`${(totals?.margin ?? 0).toFixed(1)}%`} hint="Profit ÷ charge" />
          <Card label="Cost units" value={String(overview.data?.costUnits ?? 0)} hint="Accounts and workspaces" />
        </section>

        {/* Global usage graph */}
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">
              Platform cost by category
            </h2>
            {overview.isFetching && <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" />}
          </div>
          <div className="mt-4 h-72 w-full">
            {chartData.length === 0 ? (
              <p className="pt-16 text-center text-sm text-dash-surface/55">
                No metered usage in this period yet. Usage appears here the moment it happens.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }}
                    formatter={(v: number, name: string) => [money(Number(v), currency), CATEGORY_LABEL[name as CostCategory] ?? name]}
                  />
                  {COST_CATEGORIES.map((c) => (
                    <Area
                      key={c}
                      type="monotone"
                      dataKey={c}
                      stackId="cost"
                      stroke={CATEGORY_COLOR[c]}
                      fill={CATEGORY_COLOR[c]}
                      fillOpacity={0.35}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(overview.data?.byCategory ?? []).map((c) => (
              <div key={c.category} className="flex items-center justify-between rounded-xl border border-dash-surface/12 bg-dash-surface/5 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-dash-surface">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[c.category] }} />
                  {CATEGORY_LABEL[c.category]}
                </span>
                <span className="text-sm text-dash-surface/70">
                  {money(c.actualCost, currency)} → {money(c.charge, currency)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <CreditEconomyPanel />

        <GlobalCreditEconomics locked={overview.data?.lockedSubscriptions ?? []} />

        {/* Price book */}
        <section>
          <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Price book</h2>
            <p className="mt-2 text-xs text-dash-surface/65">
              Real provider rates go here. A blank price means the metric is metered but not yet priced, so it is
              counted and never guessed.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-dash-surface/55">
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Metric</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2">Rate</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {(prices.data?.rows ?? []).map((p) => (
                    <tr key={p.metric} className="border-t border-dash-surface/10">
                      <td className="py-2 text-dash-surface/70">{CATEGORY_LABEL[p.category]}</td>
                      <td className="py-2 font-mono text-xs text-dash-surface">{p.metric}</td>
                      <td className="py-2 text-dash-surface/70">{p.unit}</td>
                      <td className="py-2">
                        <Input
                          className="h-8 w-28"
                          placeholder="unpriced"
                          value={priceDraft[p.metric] ?? (p.unitPrice === null ? "" : String(p.unitPrice))}
                          onChange={(e) => setPriceDraft((d) => ({ ...d, [p.metric]: e.target.value }))}
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const raw = priceDraft[p.metric] ?? (p.unitPrice === null ? "" : String(p.unitPrice));
                            const value = raw.trim() === "" ? null : Number(raw);
                            if (value !== null && !Number.isFinite(value)) return toast.error("Enter a number.");
                            savePrice.mutate({ metric: p.metric, unitPrice: value });
                          }}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Per-account accounting */}
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Cost units</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-dash-surface/50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, MathGPL ID or CU code"
                className="h-9 w-72 pl-8"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-dash-surface/55">
                  <th className="pb-2">Cost unit</th>
                  <th className="pb-2">Owner</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">Charge</th>
                  <th className="pb-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {(report.data?.rows ?? []).map((r) => (
                  <tr
                    key={r.costUnitId}
                    onClick={() => setOpenUnit(r.costUnitId === openUnit ? null : r.costUnitId)}
                    className="cursor-pointer border-t border-dash-surface/10 transition hover:bg-dash-surface/8"
                  >
                    <td className="py-2 font-mono text-xs text-dash-gold">{r.code}</td>
                    <td className="py-2 text-dash-surface">{r.name}</td>
                    <td className="py-2 text-dash-surface/70">{r.accountType}</td>
                    <td className="py-2 text-dash-surface/70">
                      {r.plan}
                      {r.lockedRate !== null ? ` · ${r.lockedRate}%` : ""}
                    </td>
                    <td className="py-2 text-right text-dash-surface/80">{money(r.actual, currency)}</td>
                    <td className="py-2 text-right text-dash-surface/80">{money(r.charge, currency)}</td>
                    <td className="py-2 text-right text-dash-surface">{money(r.profit, currency)}</td>
                  </tr>
                ))}
                {(report.data?.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-dash-surface/55">
                      {report.isLoading ? "Loading…" : "No cost units match this search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {openUnit && (
            <div className="mt-5 rounded-xl border border-dash-surface/15 bg-dash-navy/40 p-4">
              {detail.isLoading ? (
                <p className="text-sm text-dash-surface/60">Loading account accounting…</p>
              ) : !detail.data?.detail ? (
                <p className="text-sm text-dash-surface/60">Nothing recorded for this cost unit yet.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-dash-gold">{detail.data.detail.row.code}</p>
                      <p className="text-lg font-semibold text-dash-surface">{detail.data.detail.row.name}</p>
                      <p className="text-xs text-dash-surface/60">
                        {detail.data.detail.row.accountType}
                        {detail.data.detail.row.email ? ` · ${detail.data.detail.row.email}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-dash-surface/70">Cost {money(detail.data.detail.row.actual, currency)}</span>
                      <span className="text-dash-surface/70">Charge {money(detail.data.detail.row.charge, currency)}</span>
                      <span className="text-dash-surface">Profit {money(detail.data.detail.row.profit, currency)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {COST_CATEGORIES.map((c) => (
                      <div key={c} className="rounded-lg border border-dash-surface/12 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-dash-surface/55">{CATEGORY_LABEL[c]}</p>
                        <p className="text-sm text-dash-surface">{money(detail.data.detail!.row.categories[c], currency)}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55">
                    Recent metered events
                  </p>
                  <div className="mt-2 max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {detail.data.detail.events.map((e) => (
                          <tr key={e.id} className="border-t border-dash-surface/10">
                            <td className="py-1.5 text-dash-surface/60">{new Date(e.occurredAt).toLocaleString()}</td>
                            <td className="py-1.5 font-mono text-dash-surface/80">{e.metric}</td>
                            <td className="py-1.5 text-dash-surface/60">{e.feature ?? "—"}</td>
                            <td className="py-1.5 text-dash-surface/60">{e.model ?? ""}</td>
                            <td className="py-1.5 text-right text-dash-surface/70">
                              {e.quantity.toPrecision(3)} {e.unit}
                            </td>
                            <td className="py-1.5 text-right text-dash-surface/80">{money(e.actualCost, currency)}</td>
                            <td className="py-1.5 text-right text-dash-surface">{money(e.charge, currency)}</td>
                          </tr>
                        ))}
                        {detail.data.detail.events.length === 0 && (
                          <tr>
                            <td className="py-3 text-center text-dash-surface/55">No events in this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </EmbeddableShell>
  );
}
