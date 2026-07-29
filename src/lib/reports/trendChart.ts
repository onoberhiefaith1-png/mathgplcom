// Report System — Trend layer.
//
// The bar chart answers "how did the student do on each task?".
// This module answers "is performance improving over time?".
//
// It never touches the database: it derives everything from the SAME TaskBar
// values the bar chart already trusts, so the two charts can never disagree.

import type { TaskBar, TaskMode } from "./progressChart";

export type TrendGrouping = "week" | "month" | "year";
export type TrendFilter = "both" | TaskMode;

export interface TrendPoint {
  /** Stable bucket key, e.g. "2026-W31". */
  key: string;
  /** Axis label — W1 / Jan / 2026. */
  label: string;
  /** Human range, e.g. "26 Jul – 1 Aug 2026". */
  rangeLabel: string;
  /** Long name used in the tooltip title — "Week 5", "March 2026", "2026". */
  title: string;
  /** 0–100. On a No-Activity period this is carried forward. */
  percent: number;
  /** False when nothing was completed in this period. */
  activity: boolean;
  tasks: number;
  assignments: number;
  adventures: number;
  highest: number;
  lowest: number;
}

/** A task only lands on the timeline once it has a result to measure. */
const hasResult = (b: TaskBar) => b.frozen || b.percent > 0 || b.score > 0;

const dateOf = (b: TaskBar): Date | null => {
  const iso = b.completedAt ?? b.dueAt ?? b.startedAt;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Sunday 00:00 local time of the week containing `d`. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay()); // getDay(): 0 = Sunday
  return s;
}

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const yearStart = (d: Date) => new Date(d.getFullYear(), 0, 1);

function bucketStart(d: Date, grouping: TrendGrouping): Date {
  if (grouping === "week") return weekStart(d);
  if (grouping === "month") return monthStart(d);
  return yearStart(d);
}

function nextBucket(d: Date, grouping: TrendGrouping): Date {
  const n = new Date(d);
  if (grouping === "week") n.setDate(n.getDate() + 7);
  else if (grouping === "month") n.setMonth(n.getMonth() + 1);
  else n.setFullYear(n.getFullYear() + 1);
  return n;
}

const pad = (n: number) => String(n).padStart(2, "0");

function bucketKey(start: Date, grouping: TrendGrouping): string {
  if (grouping === "year") return `${start.getFullYear()}`;
  if (grouping === "month") return `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

function rangeLabelFor(start: Date, grouping: TrendGrouping): string {
  if (grouping === "year") return `Jan – Dec ${start.getFullYear()}`;
  if (grouping === "month") return `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`;
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Sunday → Saturday
  return `${dayLabel(start)} – ${dayLabel(end)} ${end.getFullYear()}`;
}

interface Bucket {
  start: Date;
  key: string;
  bars: TaskBar[];
}

export interface BuildTrendOptions {
  grouping: TrendGrouping;
  filter: TrendFilter;
  /** Injectable for tests — defaults to now. */
  now?: Date;
}

/**
 * One point per reporting period.
 *
 * Rules (fixed, never change):
 *  - A week is always Sunday → Saturday.
 *  - Every period between the first result and today is emitted, even empty ones.
 *  - An empty period is NOT 0%: it carries the previous period's value forward
 *    and is flagged `activity: false` so the chart can colour it differently.
 */
export function buildTrendSeries(bars: TaskBar[], opts: BuildTrendOptions): TrendPoint[] {
  const { grouping, filter } = opts;
  const now = opts.now ?? new Date();

  const eligible = bars
    .filter((b) => (filter === "both" ? true : b.mode === filter))
    .filter(hasResult)
    .map((b) => ({ bar: b, date: dateOf(b) }))
    .filter((x): x is { bar: TaskBar; date: Date } => !!x.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!eligible.length) return [];

  const byKey = new Map<string, Bucket>();
  for (const { bar, date } of eligible) {
    const start = bucketStart(date, grouping);
    const key = bucketKey(start, grouping);
    const bucket = byKey.get(key) ?? { start, key, bars: [] };
    bucket.bars.push(bar);
    byKey.set(key, bucket);
  }

  const first = bucketStart(eligible[0].date, grouping);
  const last = bucketStart(now, grouping);
  const points: TrendPoint[] = [];
  let carried = 0;
  let weekNo = 0;

  for (let cursor = first; cursor <= last; cursor = nextBucket(cursor, grouping)) {
    const key = bucketKey(cursor, grouping);
    const bucket = byKey.get(key);
    weekNo += 1;

    const label =
      grouping === "week" ? `W${weekNo}`
      : grouping === "month" ? `${MONTHS[cursor.getMonth()]}${first.getFullYear() !== last.getFullYear() ? ` ’${String(cursor.getFullYear()).slice(2)}` : ""}`
      : `${cursor.getFullYear()}`;

    const title =
      grouping === "week" ? `Week ${weekNo}`
      : grouping === "month" ? `${MONTHS_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`
      : `${cursor.getFullYear()}`;

    const base = {
      key,
      label,
      title,
      rangeLabel: rangeLabelFor(cursor, grouping),
    };

    if (!bucket || bucket.bars.length === 0) {
      points.push({
        ...base,
        percent: carried,
        activity: false,
        tasks: 0,
        assignments: 0,
        adventures: 0,
        highest: 0,
        lowest: 0,
      });
      continue;
    }

    const percents = bucket.bars.map((b) => b.percent);
    const avg = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
    carried = avg;
    points.push({
      ...base,
      percent: avg,
      activity: true,
      tasks: bucket.bars.length,
      assignments: bucket.bars.filter((b) => b.mode === "assignment").length,
      adventures: bucket.bars.filter((b) => b.mode === "adventure").length,
      highest: Math.max(...percents),
      lowest: Math.min(...percents),
    });
  }

  return points;
}
