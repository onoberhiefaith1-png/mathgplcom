# Progress Bar: Type → Style, and no question number

## What exists today (verified)

- The **segmented / 10-slot** bar is the Adventure progress bar: `ProgressColumn.tsx` draws a painted frame from `progressPresets.ts` (10 designs) and lights slots from marks via `progressFill()` (`currentMarks / totalMarks`).
- The **liquid** bar is `QuestionProgressContainer.tsx`, with 5 crystal vessel frames (blue, green, purple, orange, gold). It already rises from `current / max` — but it is only reachable from the Assets pages, not from Adventure settings.
- That liquid component hard-renders `Q{questionNumber}` on its top plate and takes `questionNumber` as a required prop.
- Progress-bar settings live in `SettingsPanel.tsx`, which today shows the 10 frame designs in one flat grid with no notion of a type.

No scoring, marks, goal or grand-total logic is touched anywhere in this plan.

## 1. Remove the question number

- Drop the `Q…` plate and the `questionNumber` prop from the liquid container entirely; its accessible label becomes just the progress ("progress 20 of 100").
- Update the Assets demo/editor pages that pass `questionNumber` so nothing breaks.
- The bottom plate keeps showing `current/max` exactly as now: `0/100 → 20/100 → 50/100 → 100/100`.

## 2. Progress Bar Type

Add a **Progress Bar Type** choice on a progress bar's settings, with two options:

- **Liquid Fill** — the crystal vessel; progress rises as liquid.
- **Segmented / 10-Slot** — the existing tower; marks light slots bottom-up.

Existing bars have no stored type, so they are read as **Segmented**, keeping every current adventure looking identical.
