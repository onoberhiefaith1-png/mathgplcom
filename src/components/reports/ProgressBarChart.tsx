// Report System — the single progress bar chart used by every report view.
//
// Rules baked in: fixed 0–100% Y axis in 10% steps, frozen while the plot
// scrolls horizontally forever, one bar per task, abbreviated labels with the
// full title on hover/tap, never merged, never compressed.

import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskBar } from "@/lib/reports/progressChart";
import type { ReportFilter, ReportSettings } from "./reportTheme";

const STEPS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
const PLOT_HEIGHT = 380;
const Y_AXIS_WIDTH = 56;

export interface ProgressBarChartProps {
  bars: TaskBar[];
  title: string;
  subtitle?: string;
  settings: ReportSettings;
  filter: ReportFilter;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

const ProgressBarChart = ({ bars, title, subtitle, settings, filter }: ProgressBarChartProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const barWidth = narrow ? 34 : 48;
  const barGap = narrow ? 26 : 40;

  const shown = useMemo(
    () => (filter === "both" ? bars : bars.filter((b) => b.mode === filter)),
    [bars, filter],
  );

  const plotWidth = shown.length * (barWidth + barGap) + barGap;

  return (
    <section ref={wrapRef} className="rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-5 shadow-sm">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--rp-fg))]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[hsl(var(--rp-muted))]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-[hsl(var(--rp-muted))]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--rp-assignment))]" /> Assignment
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--rp-adventure))]" /> Adventure
          </span>
        </div>
      </header>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] p-12 text-center text-sm text-[hsl(var(--rp-muted))]">
          No tasks yet. A bar appears here as soon as an assignment or adventure is given.
        </div>
      ) : (
        <div className="flex">
          {/* Frozen Y axis */}
          <div className="relative shrink-0" style={{ width: Y_AXIS_WIDTH }}>
            <span
              className="absolute left-0 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--rp-muted))]"
              style={{ marginTop: -20 }}
            >
              Completion
            </span>
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {STEPS.map((s) => (
                <div
                  key={s}
                  className="absolute right-3 -translate-y-1/2 text-[11px] font-medium tabular-nums text-[hsl(var(--rp-muted))]"
                  style={{ top: ((100 - s) / 100) * PLOT_HEIGHT }}
                >
                  {s}%
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 right-0 top-0 w-px bg-[hsl(var(--rp-axis))]" style={{ height: PLOT_HEIGHT }} />
          </div>

          {/* Scrolling plot — only this region moves */}
          <div className="report-scroll min-w-0 flex-1 overflow-x-auto pb-1">
            <div className="relative" style={{ height: PLOT_HEIGHT, minWidth: plotWidth }}>
              {settings.gridLines &&
                STEPS.map((s) => (
                  <div
                    key={s}
                    className={`absolute left-0 right-0 border-t ${
                      s === 0 ? "border-[hsl(var(--rp-axis))]" : "border-[hsl(var(--rp-grid))]"
                    }`}
                    style={{ top: ((100 - s) / 100) * PLOT_HEIGHT }}
                  />
                ))}
              {!settings.gridLines && (
                <div className="absolute bottom-0 left-0 right-0 border-t border-[hsl(var(--rp-axis))]" />
              )}

              <div className="absolute inset-0 flex items-end" style={{ paddingLeft: barGap, gap: barGap }}>
                {shown.map((b) => {
                  const height = Math.max(3, (b.percent / 100) * PLOT_HEIGHT);
                  const color = b.mode === "adventure" ? "hsl(var(--rp-adventure))" : "hsl(var(--rp-assignment))";
                  const open = openId === b.taskId;
                  return (
                    <button
                      key={b.taskId}
                      type="button"
                      onClick={() => setOpenId((v) => (v === b.taskId ? null : b.taskId))}
                      onMouseEnter={() => setOpenId(b.taskId)}
                      onMouseLeave={() => setOpenId((v) => (v === b.taskId ? null : v))}
                      className={`group relative shrink-0 rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--rp-axis))] ${
                        settings.animations ? "report-bar-grow transition-[filter,transform] duration-200" : ""
                      } ${open ? "brightness-110" : ""}`}
                      style={{
                        width: barWidth,
                        height,
                        background: color,
                        boxShadow: open ? `0 6px 18px -6px ${color}` : undefined,
                        // @ts-expect-error CSS var for the grow animation
                        "--rp-bar-h": `${height}px`,
                      }}
                      aria-label={`${b.fullTitle}: ${b.percent}%`}
                    >
                      {settings.barLabels && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-[hsl(var(--rp-fg))]">
                          {b.percent}%
                        </span>
                      )}
                      {open && (
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-7 w-60 -translate-x-1/2 rounded-xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-tooltip-bg))] px-3.5 py-3 text-left text-[11px] text-[hsl(var(--rp-tooltip-fg))] shadow-xl">
                          <span className="block text-[12px] font-semibold leading-snug">{b.fullTitle}</span>
                          <span
                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ background: color, color: "hsl(var(--rp-on-accent))" }}
                          >
                            {b.mode === "adventure" ? "Adventure" : "Assignment"}
                          </span>
                          <span className="mt-2 block space-y-1">
                            <Row
                              k={b.mode === "adventure" ? "Contribution" : "Score"}
                              v={`${b.score} / ${b.target || "—"}`}
                            />
                            <Row k="Completion" v={`${b.percent}%`} />
                            <Row k="Assigned" v={fmtDate(b.startedAt)} />
                            <Row k={b.frozen ? "Completed" : "Due"} v={fmtDate(b.dueAt)} />
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* X axis labels — scroll in lockstep with the bars */}
            <div className="flex pt-2.5" style={{ paddingLeft: barGap, gap: barGap, minWidth: plotWidth }}>
              {shown.map((b) => (
                <div
                  key={b.taskId}
                  title={b.fullTitle}
                  className="shrink-0 text-center text-[11px] font-semibold tracking-wide text-[hsl(var(--rp-muted))]"
                  style={{ width: barWidth }}
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

const Row = ({ k, v }: { k: string; v: string }) => (
  <span className="flex items-baseline justify-between gap-3">
    <span className="text-[hsl(var(--rp-muted))]">{k}</span>
    <span className="font-semibold tabular-nums">{v}</span>
  </span>
);

export default ProgressBarChart;
