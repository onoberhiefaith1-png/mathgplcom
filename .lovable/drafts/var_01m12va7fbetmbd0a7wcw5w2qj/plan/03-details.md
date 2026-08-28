## Data model — one source, two lenses

Everything already lives in the existing report data layer (`src/lib/reports/progressChart.ts`), which turns each assigned task (`learning_assignments`, mode `assignment` or `adventure`) into a bar with score, target, percent, dates and frozen results. That module keeps working untouched.

A new companion layer adds the extra detail the individual view needs, without duplicating logic:

- **Per-assessment rows** rather than per-task bars: each `assessments` row in a task, joined to that student's `assessment_progress` row for score/status/updated time.
- **Topic / Subtopic** come from the task's notebook (`notebooks.subject` as Topic, `notebooks.subtopic` as Subtopic), falling back to the task title when a notebook has none. Class content nodes are used when the notebook is filed under a curriculum node.
- **Type** is the task's existing `mode`: Assignment or Adventure. No separate reporting path for adventures — they are rows in the same table.
- **Marks earned / available / completion** are derived exactly as the bar chart derives them, so the two views can never disagree. Frozen results still win over live maths.
- **Floating Numbers** assessments are read the same way (marks earned out of total marks); the UI renders a completion bar and never a pass/fail label.

Nothing new is written to the database and no schema change is required.

## Files

- `src/lib/reports/studentReport.ts` — new: builds `StudentAssessmentRow[]`, summary totals, and topic → subtopic aggregates from the same dataset loader.
- `src/lib/reports/classTopics.ts` — new: class-level topic/subtopic aggregates plus per-student contribution for drill-down.
- `src/components/reports/ReportModeSwitch.tsx` — new: `Individual Student | Class Overview`.
- `src/components/reports/StudentSummaryCards.tsx`, `StudentAssessmentTable.tsx`, `TopicBreakdown.tsx`, `CompletionBar.tsx` — new presentation pieces using the existing `--rp-*` report tokens.
- `src/pages/class/ClassReportPage.tsx` — becomes the shell holding the mode switch; the current bar chart + trend + settings block moves into the Class Overview branch unchanged, with class summary cards added above it.
- `src/pages/student/StudentReportPage.tsx` — students keep their own single view; it reuses the new summary cards and assessment table so a student sees the same detail a teacher does about them.

## Behaviour

- Mode and selected student live in page state; the last used mode is remembered per browser alongside existing report settings.
- Real-time stays as-is: the existing `assessment_progress` subscription refresh feeds both modes.
- Clicking a subtopic or assessment in Class Overview lists the contributing students; picking one switches to Individual Student with that student selected.
- Filters in the individual table (Type, Topic, Subtopic, Date) filter the table, topic breakdown and graph together.
