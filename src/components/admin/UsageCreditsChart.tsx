import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  COST_CATEGORIES,
  money,
  type CostCategory,
} from "@/lib/costs/categories";
import type { UsagePoint } from "@/lib/costs/usageAnalytics.server";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `Aug 12` for days, `13:00` for hours — the same terse labels as the platform meter. */
const labelOf = (bucket: string, granularity: "hour" | "day") => {
  if (granularity === "hour") return `${bucket.slice(11, 13)}:00`;
  const [, m, d] = bucket.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${Number(d)}`;
};

const creditText = (n: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: n < 10 ? 2 : 1 }).format(n ?? 0);

type Row = { bucket: string; label: string; total: number; [key: string]: number | string };

/**
 * Slim stacked daily bars in credits, matching the platform usage meter.
 * Money stays on the surrounding cards; the tooltip shows both.
 */
export default function UsageCreditsChart({
  series,
  granularity,
  currency,
  isolated,
  onIsolate,
  height = 320,
}: {
  series: UsagePoint[];
  granularity: "hour" | "day";
  currency: string;
  isolated?: CostCategory | null;
  onIsolate?: (category: CostCategory | null) => void;
  height?: number;
}) {
  const shown: readonly CostCategory[] = isolated ? [isolated] : COST_CATEGORIES;

  const rows = useMemo<Row[]>(
    () =>
      series.map((p) => {
        const row: Row = {
          bucket: p.bucket,
          label: labelOf(p.bucket, granularity),
          total: shown.reduce<number>((sum, c) => sum + (p.credits[c] ?? 0), 0),
        };

        for (const c of COST_CATEGORIES) {
          row[c] = p.credits[c] ?? 0;
          row[`${c}__cost`] = p.cost[c] ?? 0;
        }
        return row;
      }),
    [series, granularity, isolated],
  );

  const tickGap = Math.max(0, Math.round(rows.length / 12));

  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid vertical={false} strokeDasharray="4 6" stroke="rgba(255,255,255,0.12)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={tickGap}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              minTickGap={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              tickCount={5}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              tickFormatter={(v) => creditText(Number(v))}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as Row | undefined;
                if (!row) return null;
                const lines = shown.filter((c) => Number(row[c]) > 0);
                return (
                  <div className="rounded-xl border border-dash-surface/20 bg-dash-ink/95 px-3 py-2 text-xs shadow-xl">
                    <p className="font-semibold text-dash-surface">{String(label)}</p>
                    {lines.length === 0 && <p className="mt-1 text-dash-surface/60">No usage recorded</p>}
                    {lines.map((c) => (
                      <p key={c} className="mt-1 flex items-center gap-2 text-dash-surface/80">
                        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />
                        <span className="flex-1">{CATEGORY_LABEL[c]}</span>
                        <span className="font-medium text-dash-surface">{creditText(Number(row[c]))} cr</span>
                        <span className="text-dash-surface/55">{money(Number(row[`${c}__cost`]), currency)}</span>
                      </p>
                    ))}
                    {lines.length > 0 && (
                      <p className="mt-2 border-t border-dash-surface/15 pt-1 text-dash-surface/70">
                        Total {creditText(row.total)} credits
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {shown.map((c) => (
              <Bar key={c} dataKey={c} stackId="usage" fill={CATEGORY_COLOR[c]} maxBarSize={14} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {COST_CATEGORIES.map((c) => {
          const dim = isolated && isolated !== c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onIsolate?.(isolated === c ? null : c)}
              className={`flex items-center gap-2 text-xs transition ${
                dim ? "text-dash-surface/35" : "text-dash-surface/80"
              } hover:text-dash-surface`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: CATEGORY_COLOR[c], opacity: dim ? 0.35 : 1 }}
              />
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
