// Report System — the single progress bar chart used by every report view.
//
// Rules baked in: fixed 0–100% Y axis in 10% steps, unlimited horizontally
// scrolling X axis, one bar per task, abbreviated labels with the full title on
// hover/tap, never merged, never compressed.

import { useState } from "react";
import type { TaskBar } from "@/lib/reports/progressChart";

const STEPS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
/** 1 cm ≈ 10% — the vertical scale is constant, forever. */
const CM = 37.8;
const PLOT_HEIGHT = CM * 10;
const BAR_WIDTH = 44;
const BAR_GAP = 44;

export interface ProgressBarChartProps {
  bars: TaskBar[];
  title: string;
  subtitle?: string;
}

const ProgressBarChart = ({ bars, title, subtitle }: ProgressBarChartProps) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Assignment
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(var(--accent))" }} /> Adventure
          </span>
        </div>
      </header>

      {bars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No tasks yet. A bar appears here as soon as an assignment or adventure is given.
        </div>
      ) : (
        <div className="flex">
          {/* Fixed Y axis */}
          <div className="relative shrink-0 pr-2" style={{ height: PLOT_HEIGHT + 44 }}>
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {STEPS.map((s) => (
                <div
                  key={s}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: ((100 - s) / 100) * PLOT_HEIGHT }}
                >
                  {s}%
                </div>
              ))}
            </div>
          </div>

          {/* Scrolling plot */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ height: PLOT_HEIGHT, minWidth: bars.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP }}>
              {STEPS.map((s) => (
                <div
                  key={s}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ top: ((100 - s) / 100) * PLOT_HEIGHT }}
                />
              ))}
              <div className="absolute inset-y-0 left-0 border-l border-border" />

              <div className="absolute inset-0 flex items-end" style={{ paddingLeft: BAR_GAP, gap: BAR_GAP }}>
                {bars.map((b) => (
                  <button
                    key={b.taskId}
                    type="button"
                    onClick={() => setOpenId((v) => (v === b.taskId ? null : b.taskId))}
                    onMouseEnter={() => setOpenId(b.taskId)}
                    onMouseLeave={() => setOpenId((v) => (v === b.taskId ? null : v))}
                    className="group relative shrink-0 rounded-t-sm transition-opacity hover:opacity-90"
                    style={{
                      width: BAR_WIDTH,
                      height: Math.max(2, (b.percent / 100) * PLOT_HEIGHT),
                      background: b.mode === "adventure" ? "hsl(var(--accent))" : "hsl(var(--primary))",
                    }}
                    aria-label={`${b.fullTitle}: ${b.percent}%`}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-foreground">
                      {b.percent}%
                    </span>
                    {openId === b.taskId && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-6 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-left text-[11px] text-popover-foreground shadow-lg">
                        <span className="block font-semibold leading-snug">{b.fullTitle}</span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {b.mode === "adventure" ? "Adventure" : "Assignment"} · {b.percent}%
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* X axis labels */}
            <div
              className="flex border-t border-border pt-2"
              style={{ paddingLeft: BAR_GAP, gap: BAR_GAP, minWidth: bars.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP }}
            >
              {bars.map((b) => (
                <div
                  key={b.taskId}
                  title={b.fullTitle}
                  className="shrink-0 text-center text-[11px] font-semibold tracking-wide text-muted-foreground"
                  style={{ width: BAR_WIDTH }}
                >
                  {b.abbreviation}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProgressBarChart;
