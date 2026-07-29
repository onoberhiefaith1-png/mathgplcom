## Report Dashboard UI Refinement

Presentation-layer work only. No score maths changes — filters and settings only affect what is displayed.

### 1. Report theme (white by default)
- The report page gets its own scoped theme wrapper (`report-light` / `report-dark`) rather than following the app theme. White paper surface is the default.
- Chart colours, gridlines, axis, tooltip and text all read from report-scoped CSS variables so both themes stay legible.
- Choice is stored per user in local storage and applies only to the report route.

### 2. Report Settings panel
Gear icon in the report header opens a settings sheet:
- Background: White (default) / Dark
- Grid lines: Show / Hide
- Animations: On / Off
- Bar labels: Show percentages / Hide percentages

Settings persist locally and drive the chart props. A small shared hook holds them so both the teacher and student report pages get identical settings.

### 3. Student selector (teacher only)
- Replace the raw `<select>` with a proper dropdown menu: a "Student ▾" button listing every enrolled student (searchable if the list is long).
- Clicking a name loads that student's bars immediately; a "Class" pill returns to the class report, which stays the default on open.
- Header shows which report is active (Class Report / Alice — Student Report).

### 4. Assignment / Adventure filter
- Segmented control: Both (default) / Assignment / Adventure.
- Pure display filter over the already-computed bars — no recalculation.
- Colours locked: Assignment = orange, Adventure = blue (added as report tokens, used by bars, legend and tooltips).

### 5. Chart rebuild (`ProgressBarChart`)
Rework the existing component into an Excel/Power-BI-grade chart:
- Frozen left column: Y axis 0–100% in 10% steps, plus a rotated "Completion (%)" axis title. It never scrolls.
- Only the plot + X labels scroll horizontally, in one synced scroll container, so bars and their labels always line up.
- Consistent bar width and even gaps; bars never compress — new tasks extend rightward forever.
- Rounded bar tops, soft gridlines, solid axis lines, tabular-nums percentage labels, tighter typography and margins.
- Optional grow-in animation and hover lift/highlight (both respect the Animations setting and `prefers-reduced-motion`).
- 0% tasks still render as a visible baseline stub so newly assigned work appears immediately.
- Responsive: bar width and gap step down slightly on tablet/mobile but never below a readable minimum; horizontal scroll is always available.

### 6. Rich tooltip
Hover (desktop) / tap (mobile) shows a card:

```text
Quadratic Formula
Assignment
Score        18 / 25
Completion   72%
Assigned     12 Mar 2026
Due          19 Mar 2026
```

For adventures: Contribution, Required contribution, Completion %, Assigned/Completion date.

To supply score/target/date fields, `TaskBar` gains display-only fields — `score`, `target`, `completedAt` — populated in `progressChart.ts` from values it already computes (student score sum, task target or adventure quota, frozen timestamp). For the class view these are class averages/totals. No new queries or schema changes.

### Technical notes
- Files touched: `src/components/reports/ProgressBarChart.tsx` (rebuild), new `src/components/reports/ReportSettingsSheet.tsx`, new `src/components/reports/reportTheme.ts` (settings hook + tokens), `src/pages/class/ClassReportPage.tsx`, `src/pages/student/StudentReportPage.tsx`, and a small additive change in `src/lib/reports/progressChart.ts` for the tooltip fields.
- Report colour tokens are added to `src/index.css` as scoped variables under the report theme classes — no hardcoded hex in components.
- Student page reuses the same chart, settings and filter, minus the student selector.
