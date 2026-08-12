# Match the native usage chart on Usage Analytics

Replace the current wide single-block chart on `/admin/usage-analytics` with the same chart style as the platform Usage panel in your second screenshot.

## What changes visually

- One thin bar per day (or per hour on the 24h range), across the whole selected period — not one fat block per bucket. Bars keep a fixed slim width with even gaps, so 30 or 90 days read as a dense timeline.
- Stacked segments in the same category order, each a flat solid colour, no rounded corners, sitting directly on the baseline.
- Dashed horizontal gridlines only, no vertical lines, no axis lines, no box border.
- Y axis: plain numbers on the left with no currency symbol, tight tick count (0 / 8 / 16 / 24 / 30 style), labelled as credits.
- X axis: short date labels (`Jul 14`, `Aug 3`) spread along the axis, no tick marks, muted text.
- Legend under the chart as small coloured dots with the category name beside each, wrapping onto a second line, and clicking a dot isolates that category (existing category toggling behaviour stays).
- Header shows the headline figure the way the native panel does: total credits for the period, with the period name under it (for example "69.8 run credits — in last 30 days").
- Hover tooltip: dark card listing each category for that day with its credits, plus a day total.

## What the chart measures

Bars are drawn in credits, matching the platform panel, so the shape lines up with what you see natively. Money stays where it belongs: the summary cards, category cards and the revenue ledger keep showing cost, charge and profit in pounds. The tooltip shows credits and the pound cost side by side per category so nothing is lost.

Days with no usage render as empty slots rather than being skipped, so the timeline spacing stays true.

## Where it applies

Same chart component used on both admin pages so they never drift: Usage Analytics and, if a chart is shown there, Cost & Revenue Analysis.

## Technical section

- New `src/components/admin/UsageCreditsChart.tsx` wrapping recharts `BarChart` with `barSize` fixed, `maxBarSize`, `CartesianGrid strokeDasharray` horizontal-only, `axisLine={false}` / `tickLine={false}`, custom `tick` formatter for short dates, custom `Tooltip` content and a custom legend rendered as dots (not recharts' default legend).
- Series continue to come from `fetchUsageAnalytics`; the series builder in `src/lib/costs/usageAnalytics.server.ts` gains a per-bucket credits value per category (cost ÷ the credit rate recorded on the event, falling back to the current rate) and fills missing buckets with zero rows so the axis is continuous.
- `src/pages/admin/UsageAnalytics.tsx` swaps its inline `BarChart` block for the new component and moves the headline credits figure into the section header; category toggle state stays in the page.
- Colours keep using the existing `CATEGORY_COLOR` tokens in `src/lib/costs/categories.ts`; no hardcoded colour utilities in the component.
