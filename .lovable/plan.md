## Add a leading gap = bar width between the Y-axis and the first bar

Currently `BarChart.tsx` centres the bar group horizontally in the plot area:

```ts
const startX = PAD.left + Math.max(0, (plotW - totalW) / 2);
```

This produces uneven left/right padding depending on how many bars fit. The user wants:

> The distance between the Y-axis and the first bar equals the width of one bar — for **both** Bar Chart and Histogram.

### Change

In `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx`, replace the centring formula with a fixed leading offset:

```ts
const leadGap = barWidth;               // same rule for bar + histogram
const startX = PAD.left + leadGap;
const xForBar = (i: number) => startX + i * slot;
```

`slot` stays as `barWidth + gap` (gap = barWidth for bar chart, 0 for histogram), so:

- **Bar chart:** Y-axis │ [gap = w] [bar w] [gap = w] [bar w] …
- **Histogram:** Y-axis │ [gap = w] [bar w][bar w][bar w] …

No other layout or panel change. Trailing whitespace on the right is whatever remains of the plot; bars simply flow left-to-right from the leading gap.

### File touched

- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — one-line change to `startX`.

### Acceptance

- With a 2-bar chart at 10 % width, the space between the Y-axis and the first bar visibly equals one bar width, and equals the gap between the two bars.
- In Histogram mode, the same leading gap appears, but the bars themselves are flush against each other.
