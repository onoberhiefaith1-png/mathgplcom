import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Search, Users } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  COST_CATEGORIES,
  RANGES,
  money,
  type CostCategory,
  type RangeKey,
} from "@/lib/costs/categories";
import { fetchAccountOptions, fetchCategoryEvents, fetchUsageAnalytics } from "@/lib/costs/usage.functions";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function useRange() {
  const [key, setKey] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 7 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));

  const { from, to } = useMemo(() => {
    if (key === "custom") return { from: `${customFrom}T00:00:00Z`, to: `${customTo}T23:59:59Z` };
    const days = RANGES.find((r) => r.key === key)?.days ?? 7;
    return { from: new Date(Date.now() - days * 86_400_000).toISOString(), to: new Date().toISOString() };
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

const compact = (n: number) =>
  new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 2 }).format(n ?? 0);

export default function UsageAnalytics() {
  const range = useRange();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"all" | "users">("all");
  const [accountQuery, setAccountQuery] = useState("");
  const [costUnitId, setCostUnitId] = useState<string | undefined>(undefined);
  const [openCategory, setOpenCategory] = useState<CostCategory | null>(null);

  const args = { from: range.from, to: range.to, ...(costUnitId ? { costUnitId } : {}) };

  const analytics = useQuery({
    queryKey: ["usage-analytics", args],
    queryFn: () => fetchUsageAnalytics({ data: args }),
  });

  const accounts = useQuery({
    queryKey: ["usage-accounts", range.from, range.to, accountQuery],
    queryFn: () => fetchAccountOptions({ data: { from: range.from, to: range.to, query: accountQuery } }),
    enabled: mode === "users",
  });

  const events = useQuery({
    queryKey: ["usage-category-events", openCategory, args],
    queryFn: () => fetchCategoryEvents({ data: { ...args, category: openCategory! } }),
    enabled: !!openCategory,
  });

  // Live: new metered usage appears without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel("admin-usage-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "usage_events" }, () => {
        void qc.invalidateQueries({ queryKey: ["usage-analytics"] });
        void qc.invalidateQueries({ queryKey: ["usage-category-events"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const currency = analytics.data?.currency ?? "GBP";
  const chartData = (analytics.data?.series ?? []).map((p) => ({
    bucket: analytics.data?.granularity === "hour" ? p.bucket.slice(11) : p.bucket.slice(5),
    ...p.cost,
  }));
  const totals = analytics.data?.totals;
  const ai = analytics.data?.aiTotals;
  const selected = accounts.data?.rows.find((a) => a.costUnitId === costUnitId);

  return (
    <DashboardShell
      title="Usage Analytics"
      subtitle="Live measurement of Database, Network, Storage, Compute, Realtime and AI usage, metered by MathGPL itself."
      actions={
        <Link
          to="/admin/cost-revenue"
          className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface transition hover:bg-dash-surface/20"
        >
          Usage &amp; revenue
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Scope + period */}
        <section className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-dash-surface/20">
            {(["all", "users"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (m === "all") setCostUnitId(undefined);
                }}
                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  mode === m ? "bg-dash-gold/20 text-dash-gold" : "text-dash-surface/70 hover:bg-dash-surface/10"
                }`}
              >
                {m === "all" ? "All usage" : "Users"}
              </button>
            ))}
          </div>
          <span className="h-5 w-px bg-dash-surface/20" />
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
              <Input type="date" value={range.customFrom} onChange={(e) => range.setCustomFrom(e.target.value)} className="h-8 w-36" />
              <span className="text-xs text-dash-surface/60">to</span>
              <Input type="date" value={range.customTo} onChange={(e) => range.setCustomTo(e.target.value)} className="h-8 w-36" />
            </div>
          )}
          {analytics.isFetching && <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" />}
        </section>

        {/* User picker */}
        {mode === "users" && (
          <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-surface/50" />
                <Input
                  value={accountQuery}
                  onChange={(e) => setAccountQuery(e.target.value)}
                  placeholder="Search by name, MathGPL ID, cost unit or account type"
                  className="h-9 pl-9"
                />
              </div>
              {costUnitId && (
                <button
                  type="button"
                  onClick={() => setCostUnitId(undefined)}
                  className="rounded-full border border-dash-surface/25 px-3 py-1.5 text-xs text-dash-surface/80 hover:bg-dash-surface/10"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-dash-surface/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-dash-surface/10 text-dash-surface/70">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Cost unit</th>
                    <th className="px-3 py-2 text-right">Credits</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(accounts.data?.rows ?? []).map((a) => (
                    <tr
                      key={a.costUnitId}
                      onClick={() => setCostUnitId(a.costUnitId)}
                      className={`cursor-pointer border-t border-dash-surface/10 transition hover:bg-dash-surface/10 ${
                        costUnitId === a.costUnitId ? "bg-dash-gold/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-dash-surface">{a.name}</td>
                      <td className="px-3 py-2 capitalize text-dash-surface/70">{a.accountType}</td>
                      <td className="px-3 py-2 font-mono text-dash-surface/60">{a.code}</td>
                      <td className="px-3 py-2 text-right text-dash-surface/80">{money(a.balance, currency)}</td>
                      <td className="px-3 py-2 text-right text-dash-surface/80">{money(a.cost, currency)}</td>
                    </tr>
                  ))}
                  {accounts.data && accounts.data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-dash-surface/60">
                        No accounts match that search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selected && (
          <p className="flex items-center gap-2 text-xs text-dash-gold">
            <Users className="h-3.5 w-3.5" /> Filtered to {selected.name} ({selected.code})
          </p>
        )}

        {/* Summary */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Metered cost" value={money(totals?.cost ?? 0, currency)} hint="What the platform paid" />
          <Card label="Customer charge" value={money(totals?.charge ?? 0, currency)} hint="At the locked margin" />
          <Card label="Collected" value={money(totals?.paid ?? 0, currency)} hint="Credits actually deducted" />
          <Card label="Usage events" value={compact(totals?.events ?? 0)} hint="Metered operations in range" />
        </section>

        {/* Stacked usage graph */}
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">
            Usage by category {analytics.data?.granularity === "hour" ? "(hourly)" : "(daily)"}
          </h2>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.55)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.55)" fontSize={11} tickFormatter={(v) => money(Number(v), currency)} />
                <Tooltip
                  contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }}
                  formatter={(v: number, name) => [money(Number(v), currency), CATEGORY_LABEL[name as CostCategory] ?? name]}
                />
                <Legend formatter={(v) => CATEGORY_LABEL[v as CostCategory] ?? v} />
                {COST_CATEGORIES.map((c) => (
                  <Bar key={c} dataKey={c} stackId="usage" fill={CATEGORY_COLOR[c]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Category cards → drill-down */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(analytics.data?.byCategory ?? []).map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setOpenCategory(openCategory === c.category ? null : c.category)}
              className={`rounded-2xl border p-4 text-left transition ${
                openCategory === c.category
                  ? "border-dash-gold bg-dash-gold/10"
                  : "border-dash-surface/15 bg-dash-surface/5 hover:bg-dash-surface/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[c.category] }} />
                <p className="text-sm font-semibold text-dash-surface">{CATEGORY_LABEL[c.category]}</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-dash-surface">{money(c.cost, currency)}</p>
              <p className="mt-1 text-xs text-dash-surface/60">
                {compact(c.quantity)} units · {compact(c.events)} events · charge {money(c.charge, currency)}
              </p>
            </button>
          ))}
        </section>

        {/* AI activity summary */}
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">AI activity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="Input tokens" value={compact(ai?.inputTokens ?? 0)} />
            <Card label="Output tokens" value={compact(ai?.outputTokens ?? 0)} />
            <Card label="Images" value={compact(ai?.images ?? 0)} />
            <Card label="Audio minutes" value={compact(ai?.audioMinutes ?? 0)} />
            <Card label="AI cost" value={money(ai?.cost ?? 0, currency)} />
          </div>
        </section>

        {/* Drill-down table */}
        {openCategory && (
          <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">
                {CATEGORY_LABEL[openCategory]} activity
              </h2>
              {events.isFetching && <Loader2 className="h-4 w-4 animate-spin text-dash-surface/50" />}
            </div>
            <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-dash-surface/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-dash-surface/10 text-dash-surface/70">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Activity</th>
                    {openCategory === "ai" && <th className="px-3 py-2">Model</th>}
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(events.data?.rows ?? []).map((e) => (
                    <tr key={e.id} className="border-t border-dash-surface/10">
                      <td className="px-3 py-2 text-dash-surface/70">{new Date(e.occurredAt).toLocaleString("en-GB")}</td>
                      <td className="px-3 py-2 text-dash-surface">{e.owner}</td>
                      <td className="px-3 py-2 text-dash-surface/80">{e.resource}</td>
                      {openCategory === "ai" && <td className="px-3 py-2 text-dash-surface/60">{e.model ?? "—"}</td>}
                      <td className="px-3 py-2 text-right text-dash-surface/80">
                        {compact(e.quantity)} {e.unit}
                      </td>
                      <td className="px-3 py-2 text-right text-dash-surface">{money(e.cost, currency)}</td>
                    </tr>
                  ))}
                  {events.data && events.data.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-dash-surface/60">
                        No {CATEGORY_LABEL[openCategory].toLowerCase()} usage in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
