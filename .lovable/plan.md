# Trend Report — line chart alongside the bar chart

The bar chart stays exactly as it is ("how did the student do on each task?"). A new Trend chart is added below it on both the teacher Class Report and the Student Report, answering "is performance improving over time?".

## 1. Data layer (`src/lib/reports/progressChart.ts` + new `src/lib/reports/trendChart.ts`)

Reuse the existing task data — no new database work, no schema change. The trend is derived from the same `TaskBar` values the bar chart already trusts.

- Add a `completedAt` field to `TaskBar` so a task can be placed on a timeline. Source order: the frozen result's timestamp (from `report_task_results`) → `dueAt` → `startedAt`. Only tasks with a date and with activity (percent recorded / frozen, or score > 0) count as "completed" for a period.
- New `buildTrendSeries(bars, { grouping, filter })` in `trendChart.ts`:
  - Buckets: `week` (Sunday 00:00 → Saturday 23:59, local time), `month`, `year`.
  - Range: from the first task period to the current period — every period in between is emitted, including empty ones.
  - For each period: filter by mode (Both / Assignment / Adventure), average the task percentages, round.
  - Empty period → `{ activity: false }` and its value **carries forward** the previous period's average (first-ever empty periods before any activity are dropped, so the chart never opens on a flat phantom line).
  - Each point also carries: `assignments`, `adventures`, `tasksCompleted`, `highest`, `lowest`, and the period label (`W1…`, `Jan…`, `2026…`).
- Class-level trend uses the existing class-average bars; student trend uses that student's bars. Both come from `loadReportData` already in memory, so switching student/filter/grouping is instant with no refetch.

## 2. Trend chart component (`src/components/reports/TrendLineChart.tsx`)

Hand-rolled SVG (same approach and tokens as the bar chart, no chart library):

- Fixed Y axis 0–100% in 10% steps, frozen while the plot scrolls horizontally; X axis chronological and scrollable for long histories.
- **Straight** segments between points (no smoothing), rounded point markers.
- Segment colouring: a segment is "activity" only if the period it ends on has activity; otherwise it is drawn in the No-Activity colour as a horizontal carry-forward line. Markers follow the same rule (blue dot vs red dot).
- Gradient area fill under the line, split per segment so activity stretches fade blue and inactive stretches fade red; soft vertical gradient fading to transparent at the axis, never a solid block.
- Grid lines respect the existing `gridLines` setting; animations respect `animations` (line draw-in via stroke-dash).
- Hover/tap on a marker shows a tooltip:
  - Activity: `Week 5 · Average 78% · Tasks Completed 6 · Assignments 4 · Adventures 2 · Highest / Lowest`.
  - No activity: `Week 8 — No Activity`, plus "Performance carried forward from the previous reporting period."
- Responsive: same ResizeObserver narrow-mode treatment as the bar chart.

## 3. Grouping control (`src/components/reports/TrendRangeBar.tsx`)

Small segmented control — Weekly / Monthly / Yearly — sitting on the trend card header. One chart, only the X-axis grouping changes. The existing Both/Assignment/Adventure `ReportFilterBar` is shared by both charts on the page.

## 4. Colour settings (`reportTheme.ts` + `ReportSettingsSheet.tsx`)

Extend `ReportSettings` (already persisted per browser) with a `trend` block, defaults:

- Activity line: Blue
- No Activity line: Red
- Area fill: Light blue (derived from the activity colour)
- Grid lines: Light grey

New "Trend Colours" section in the settings sheet with a small swatch picker per role (a fixed palette of ~6 professional hues each, plus the default). Also a Weekly/Monthly/Yearly default and a show/hide toggle for the trend card. These settings affect the Trend Report only; bar-chart colours are untouched.

## 5. Pages

`ClassReportPage.tsx` and `StudentReportPage.tsx`: render `TrendLineChart` under the existing `ProgressBarChart`, sharing the same filter state, the same student selection (teacher), and the same settings object. Titles: "Class Trend" / "Student Trend", subtitle naming the grouping.

## Technical notes

- No migration required; `report_task_results` already stores the freeze timestamps used for period placement.
- All colours flow through the existing `--rp-*` token system plus new `--rp-trend-*` variables set inline from settings, so white and dark report backgrounds both stay legible.
- Unit test for `buildTrendSeries`: Sunday→Saturday boundaries, carry-forward on empty periods, filter maths, and month/year grouping.
