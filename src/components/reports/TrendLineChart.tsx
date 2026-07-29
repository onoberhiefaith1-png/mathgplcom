// Report System — the Trend (line) chart.
//
// Answers "is performance improving over time?" — one point per reporting
// period (week / month / year). Rules baked in:
//  - fixed 0–100% Y axis in 10% steps, frozen while the plot scrolls,
//  - straight segments only (never smoothed — a curve would imply values that
//    were never measured),
//  - inactive periods carry the previous value forward in the No-Activity
//    colour instead of dropping to 0% or breaking the line,
//  - gradient area fill under each segment, tinted to that segment's colour.

import { useEffect, useMemo, useRef, useState } from "react";
import type { TrendPoint } from "@/lib/reports/trendChart";
import { useLatestScroll } from "@/lib/reports/useLatestScroll";
import type { ReportSettings } from "./reportTheme";

const STEPS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
const PLOT_HEIGHT = 340;
const Y_AXIS_WIDTH = 56;
const PAD_X = 44;

export interface TrendLineChartProps {
  points: TrendPoint[];
  title: string;
  subtitle?: string;
  settings: ReportSettings;
}

const TrendLineChart = ({ points, title, subtitle, settings }: TrendLineChartProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { activity, inactive, fill, grid } = settings.trend;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = narrow ? 64 : 92;
  const plotWidth = Math.max(320, PAD_X * 2 + Math.max(0, points.length - 1) * step);

  const xy = useMemo(
    () =>
      points.map((p, i) => ({
        x: PAD_X + i * step,
        y: ((100 - p.percent) / 100) * PLOT_HEIGHT,
        p,
        i,
      })),
    [points, step],
  );

  // One segment per consecutive pair. A segment is "activity" only when the
  // period it lands on actually had work — otherwise it is a carry-forward.
  const segments = useMemo(
    () =>
      xy.slice(1).map((b, idx) => {
        const a = xy[idx];
        return { a, b, active: b.p.activity };
      }),
    [xy],
  );

  return (
    <section
      ref={wrapRef}
      className="rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-5 shadow-sm"
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--rp-fg))]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[hsl(var(--rp-muted))]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-[hsl(var(--rp-muted))]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: activity }} /> Activity
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: inactive }} /> No activity
          </span>
        </div>
      </header>

      {points.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] p-12 text-center text-sm text-[hsl(var(--rp-muted))]">
          No completed tasks yet. The trend line starts as soon as the first assignment or adventure is scored.
        </div>
      ) : (
        <div className="flex">
          {/* Frozen Y axis */}
          <div className="relative shrink-0" style={{ width: Y_AXIS_WIDTH }}>
            <span
              className="absolute left-0 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--rp-muted))]"
              style={{ marginTop: -20 }}
            >
              Average
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
            <div
              className="absolute bottom-0 right-0 top-0 w-px bg-[hsl(var(--rp-axis))]"
              style={{ height: PLOT_HEIGHT }}
            />
          </div>

          {/* Scrolling plot */}
          <div className="report-scroll min-w-0 flex-1 overflow-x-auto pb-1">
            <div className="relative" style={{ height: PLOT_HEIGHT, minWidth: plotWidth }}>
              <svg
                width={plotWidth}
                height={PLOT_HEIGHT}
                viewBox={`0 0 ${plotWidth} ${PLOT_HEIGHT}`}
                className="block overflow-visible"
                role="img"
                aria-label={title}
              >
                <defs>
                  <linearGradient id="rp-trend-fill-active" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.42} />
                    <stop offset="60%" stopColor={fill} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rp-trend-fill-idle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={inactive} stopOpacity={0.2} />
                    <stop offset="60%" stopColor={inactive} stopOpacity={0.07} />
                    <stop offset="100%" stopColor={inactive} stopOpacity={0} />
                  </linearGradient>
                </defs>

                {settings.gridLines &&
                  STEPS.map((s) => {
                    const y = ((100 - s) / 100) * PLOT_HEIGHT;
                    return (
                      <line
                        key={s}
                        x1={0}
                        x2={plotWidth}
                        y1={y}
                        y2={y}
                        stroke={s === 0 ? "hsl(var(--rp-axis))" : grid}
                        strokeWidth={s === 0 ? 1.25 : 1}
                      />
                    );
                  })}
                {!settings.gridLines && (
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={PLOT_HEIGHT}
                    y2={PLOT_HEIGHT}
                    stroke="hsl(var(--rp-axis))"
                    strokeWidth={1.25}
                  />
                )}

                {/* Area fill, one polygon per segment so colours can differ */}
                {segments.map((s, i) => (
                  <polygon
                    key={`fill-${i}`}
                    points={`${s.a.x},${s.a.y} ${s.b.x},${s.b.y} ${s.b.x},${PLOT_HEIGHT} ${s.a.x},${PLOT_HEIGHT}`}
                    fill={`url(#rp-trend-fill-${s.active ? "active" : "idle"})`}
                  />
                ))}
                {/* A single point still deserves a soft footprint */}
                {segments.length === 0 && xy.length === 1 && (
                  <polygon
                    points={`${xy[0].x - 26},${xy[0].y} ${xy[0].x + 26},${xy[0].y} ${xy[0].x + 26},${PLOT_HEIGHT} ${xy[0].x - 26},${PLOT_HEIGHT}`}
                    fill="url(#rp-trend-fill-active)"
                  />
                )}

                {/* Straight line segments */}
                {segments.map((s, i) => (
                  <line
                    key={`line-${i}`}
                    x1={s.a.x}
                    y1={s.a.y}
                    x2={s.b.x}
                    y2={s.b.y}
                    stroke={s.active ? activity : inactive}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={s.active ? undefined : "7 5"}
                    className={settings.animations ? "report-trend-draw" : undefined}
                  />
                ))}

                {/* Markers */}
                {xy.map((pt) => {
                  const c = pt.p.activity ? activity : inactive;
                  const open = openIdx === pt.i;
                  return (
                    <g key={pt.p.key}>
                      <circle cx={pt.x} cy={pt.y} r={open ? 9 : 7} fill="hsl(var(--rp-panel))" stroke={c} strokeWidth={2.5} />
                      <circle cx={pt.x} cy={pt.y} r={open ? 4 : 3} fill={c} />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={18}
                        fill="transparent"
                        className="cursor-pointer outline-none"
                        onMouseEnter={() => setOpenIdx(pt.i)}
                        onMouseLeave={() => setOpenIdx((v) => (v === pt.i ? null : v))}
                        onClick={() => setOpenIdx((v) => (v === pt.i ? null : pt.i))}
                        aria-label={`${pt.p.title}: ${pt.p.activity ? `${pt.p.percent}%` : "no activity"}`}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {openIdx !== null && xy[openIdx] && (
                <div
                  className="pointer-events-none absolute z-30 w-60 -translate-x-1/2 rounded-xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-tooltip-bg))] px-3.5 py-3 text-left text-[11px] text-[hsl(var(--rp-tooltip-fg))] shadow-xl"
                  style={{
                    left: Math.min(Math.max(xy[openIdx].x, 130), plotWidth - 130),
                    top: Math.max(6, xy[openIdx].y - 20),
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="text-[12px] font-semibold leading-snug">{xy[openIdx].p.title}</div>
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--rp-muted))]">{xy[openIdx].p.rangeLabel}</div>
                  {xy[openIdx].p.activity ? (
                    <div className="mt-2 space-y-1">
                      <Row k="Average" v={`${xy[openIdx].p.percent}%`} />
                      <Row k="Tasks completed" v={`${xy[openIdx].p.tasks}`} />
                      <Row k="Assignments" v={`${xy[openIdx].p.assignments}`} />
                      <Row k="Adventures" v={`${xy[openIdx].p.adventures}`} />
                      <Row k="Highest" v={`${xy[openIdx].p.highest}%`} />
                      <Row k="Lowest" v={`${xy[openIdx].p.lowest}%`} />
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="font-semibold" style={{ color: inactive }}>No Activity</div>
                      <p className="text-[10px] leading-relaxed text-[hsl(var(--rp-muted))]">
                        No assignment or adventure completed during this period. Performance carried forward
                        from the previous reporting period ({xy[openIdx].p.percent}%).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* X axis labels — scroll in lockstep with the line */}
            <div className="relative pt-2.5" style={{ minWidth: plotWidth, height: 22 }}>
              {xy.map((pt) => (
                <div
                  key={pt.p.key}
                  title={`${pt.p.title} · ${pt.p.rangeLabel}`}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tracking-wide text-[hsl(var(--rp-muted))]"
                  style={{ left: pt.x }}
                >
                  {pt.p.label}
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
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[hsl(var(--rp-muted))]">{k}</span>
    <span className="font-semibold tabular-nums">{v}</span>
  </div>
);

export default TrendLineChart;
