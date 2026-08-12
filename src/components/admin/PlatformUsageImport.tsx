import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { CATEGORY_LABEL, COST_CATEGORIES, money, type CostCategory } from "@/lib/costs/categories";
import { fetchAccountOptions, importPlatformUsage } from "@/lib/costs/usage.functions";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const emptyRows = () => Object.fromEntries(COST_CATEGORIES.map((c) => [c, ""])) as Record<CostCategory, string>;

/**
 * Owner-only importer for the real platform credit meter. One snapshot per day
 * per account; re-importing the same day replaces it, so nothing double counts.
 */
export default function PlatformUsageImport({ costUnitId }: { costUnitId?: string }) {
  const qc = useQueryClient();
  const [account, setAccount] = useState(costUnitId ?? "");
  const [day, setDay] = useState(isoDay(new Date()));
  const [rate, setRate] = useState("0.30");
  const [credits, setCredits] = useState<Record<CostCategory, string>>(emptyRows);

  const window = useMemo(() => {
    const to = new Date().toISOString();
    return { from: new Date(Date.now() - 90 * 86_400_000).toISOString(), to };
  }, []);

  const accounts = useQuery({
    queryKey: ["import-accounts", window.from],
    queryFn: () => fetchAccountOptions({ data: window }),
  });

  const selected = account || costUnitId || "";
  const total = COST_CATEGORIES.reduce((sum, c) => sum + (Number(credits[c]) || 0), 0);
  const rateValue = Number(rate) || 0;

  const run = useMutation({
    mutationFn: () =>
      importPlatformUsage({
        data: {
          costUnitId: selected,
          day,
          creditRate: rateValue,
          rows: COST_CATEGORIES.filter((c) => (Number(credits[c]) || 0) > 0).map((c) => ({
            category: c,
            credits: Number(credits[c]),
            label: `${CATEGORY_LABEL[c]} platform usage`,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} usage lines for ${day}.`);
      setCredits(emptyRows());
      void qc.invalidateQueries({ queryKey: ["usage-analytics"] });
      void qc.invalidateQueries({ queryKey: ["usage-category-events"] });
      void qc.invalidateQueries({ queryKey: ["revenue-ledger"] });
      void qc.invalidateQueries({ queryKey: ["usage-accounts"] });
      void qc.invalidateQueries({ queryKey: ["revenue-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">Platform usage import</h2>
      <p className="mt-1 text-xs text-dash-surface/60">
        Enter the platform credit figures for one day and account. Credits are valued at the rate below and recorded as
        unpaid, so they read as a loss until a payment is recorded. Re-importing the same day replaces it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-dash-surface/70">
          Account
          <select
            value={selected}
            onChange={(e) => setAccount(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-dash-surface/20 bg-dash-ink/60 px-2 text-sm text-dash-surface"
          >
            <option value="">Choose an account…</option>
            {(accounts.data?.rows ?? []).map((a) => (
              <option key={a.costUnitId} value={a.costUnitId}>
                {a.name} — {a.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-dash-surface/70">
          Day covered
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs text-dash-surface/70">
          Value per credit
          <Input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 h-9" />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COST_CATEGORIES.map((c) => (
          <label key={c} className="text-xs text-dash-surface/70">
            {CATEGORY_LABEL[c]} credits
            <Input
              type="number"
              step="0.000001"
              min="0"
              value={credits[c]}
              onChange={(e) => setCredits((prev) => ({ ...prev, [c]: e.target.value }))}
              placeholder="0"
              className="mt-1 h-9"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!selected || total <= 0 || run.isPending}
          onClick={() => run.mutate()}
          className="inline-flex items-center gap-2 rounded-full bg-dash-gold/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold transition hover:bg-dash-gold/30 disabled:opacity-40"
        >
          {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import usage
        </button>
        <p className="text-xs text-dash-surface/60">
          {total.toFixed(3)} credits · {money(total * rateValue)} platform cost · recorded as unpaid
        </p>
      </div>
    </section>
  );
}
