# Fix the hidden Structures icon on the student board

## Problem
On the student/assessment board the **Structures toggle button** (the □-function icon) is fixed to the bottom-right corner at `right:12, bottom: bottomInset+12`. The per-line **"Check line N"** button is also fixed to the bottom-right (`bottom-6 right-6`). They overlap, so the Check pill covers the Structures icon and the student can't open it to insert the structure (fraction, root, power, etc.) needed to finish the line.

A previous change moved the *expanded* structure strip up, but not the toggle button you actually tap — so it's still buried.

## Fix

### 1. Lift the Structures toggle clear of the Check button
- In `AssistantButtons.tsx`, add a prop (e.g. `liftRightBottom?: number`, default `0`) and apply it as extra bottom offset on the **Structures** button only:
  `bottom: bottomInset + 12 + liftRightBottom`.
- In `PresentationView.tsx`, pass `liftRightBottom` so the Structures button rises above the Check pill **only when the Check button is present** (i.e. `hasGuidedLines`). The Check button is ~50px tall sitting 24px from the bottom, so a lift of about 64px clears it with margin. When there is no Check button (teacher Smartboard), the lift is `0` and nothing changes.

This keeps the icon in the same familiar corner, just raised enough to be fully tappable, and it remains independent of the already-raised expanded structure strip.

### 2. Confirm the lesson-note structures show in the panel
The data path is already wired: lesson-note `floating_lines[].containers` → `createAssessment` → assessment `questions[].lines[].containers` → `assessmentBoardSource` → `ReservoirLine.containers` → `StructurePanel.requiredStructures` for the active line. After fix #1, verify on the live board that opening Structures on the active line shows exactly the structures the teacher's lesson note used for that line.

- Note: assessments **created before** the container-carrying change won't have `containers` stored, so their structure panel will be empty. If this assignment is one of those, the teacher needs to re-publish/recreate the assessment so the structures are captured. This will be flagged after testing.

## Technical details
- Files: `src/components/smartboard/AssistantButtons.tsx`, `src/components/smartboard/PresentationView.tsx`.
- No backend/grading changes. Purely a chrome-positioning change plus verification of the existing structure data flow.
- The button stays `position: fixed` and `z-40`; the Check button is `z-[60]`, so even on overlap the Check button wins — hence the need to physically move the Structures button rather than restack.
