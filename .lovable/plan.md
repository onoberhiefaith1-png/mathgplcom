# Report System – Phase 1: Student Progress Bar Chart

Add a **Report** section to both the teacher class dashboard and the student class page (after Gallery), built on a single reusable progress bar chart.

## Task model (one bar = one task)

Bars come from `learning_assignments` (the existing per-class task registry), which already distinguishes `mode = 'assignment' | 'adventure'` and holds title, notebook, game, due date and status. Every active or archived row for the class = one bar, ordered by `started_at`, never merged, duplicates preserved.

- A bar appears the moment a task is assigned, at 0%.
- Bars only change height as progress arrives; they never disappear.

## Percentage rules

**Assignment** — sum the student's `assessment_progress.score` across the assessments belonging to that task, divided by the sum of `total_marks`, ×100, capped 0–100. Past due with no attempt = 0%.

**Adventure** — the student's earned marks across the adventure's linked boards divided by their individual required quota (the existing `requiredContribution` = total required marks ÷ member count), ×100, capped at 100%. Extra contribution beyond quota still shows 100%.

**Class Report** — for each task, the mean of all class members' percentages (rounded), so a task with 28 students averaging 82% renders an 82% bar.

## Historical accuracy

To honour "don't recalculate finished adventures after the pass mark changes", add one additive table `report_task_results` (task id, student id, percent, frozen quota/total, frozen_at) with RLS: students read their own rows, teachers read rows for classes they own. When a task is archived (completed or due date passed), the current percentages are frozen into it. The report reads frozen rows when present and computes live otherwise. No existing tables are modified.

## Chart component

New `src/components/reports/ProgressBarChart.tsx`:

- Fixed Y-axis 0–100% in 10% steps, gridlines, constant scale, ~1 cm per 10%.
- X-axis unlimited with horizontal scroll; bars keep a fixed width and gap (no compression).
- Auto-abbreviated 3-letter labels ("Quadratic Formula" → QUA) with the full title in a hover tooltip / tap popover.
- Colour distinguishes Assignment vs Adventure; a small legend sits above the chart.
- Empty state when no tasks exist yet.

## Pages and navigation

- `src/pages/class/ClassReportPage.tsx` (teacher, route `/teaching-hub/classes/:classId/report`): top toggle **Class | Student ▾**, defaulting to Class Report; the Student dropdown lists class members and swaps the chart to that student's data.
- `src/pages/student/StudentReportPage.tsx` (route `/student/class/:classId/report`): the student's own chart only, no student picker.
- Add a **Report** tile after Gallery on `ClassDashboardPage.tsx` and a Report entry after Gallery on `StudentClassPage.tsx`.
- Both routes registered in `App.tsx`; access enforced by the existing owner/member checks.

## Data layer

`src/lib/reports/progressChart.ts` exposes `loadStudentTaskBars(classId, studentId)` and `loadClassTaskBars(classId)`, returning `{ taskId, mode, fullTitle, abbreviation, percent }[]`. All later Weekly/Monthly/Term/Yearly reports will read from this module rather than recomputing scores.

## Technical notes

- Reuses `assessment_progress`, `class_game_boards`, `class_members` and the existing quota maths in `useAdventureSync`, factored into a shared helper so adventure percentages stay identical to the live dashboards.
- Chart is a plain SVG/flex implementation using semantic design tokens — no new charting dependency.
- Data refreshes on mount plus a lightweight realtime subscription on `assessment_progress` for the class.
