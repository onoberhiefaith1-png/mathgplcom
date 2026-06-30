
# Plan: Structure-Aware Layout + Bounded Cursor/Floating Movement

Two related upgrades to the Smartboard presentation engine:
1. **Mathematical Structure Recognition** — cursor never lands inside a multi-row math object; next Lesson Line always starts below the full bounding box.
2. **Bounded Movement Rules** — cursor gets up to 3 manual rows of slack below the auto position; Floating Number panel becomes drag-bounded with collision avoidance.

---

## Part 1 — Mathematical Structure Recognition Engine

### Goal
Treat every math node (frac, root, matrix, integral, summation, piecewise, large bracket, sub/super, vector, long division, etc.) as **one indivisible Lesson Object** with a real bounding box. Row advancement uses the structure's **bottom edge + Row Spacing**, not its top row.

### Where it lives
- `src/lib/smartboard/mathTree.ts` — already produces the tree; extend each node kind with an `intrinsicHeight` calc (rows of font-height, not pixels).
- `src/components/smartboard/MathTreeRender.tsx` — already renders intrinsic height; add a `measuredBottom` report via `ResizeObserver` so the grid knows the true pixel bottom after fonts load.
- `src/lib/smartboard/grid.ts` — add `structureBottom(lessonLineIdx)` helper that returns the lowest occupied y of all nodes on that Lesson Line.
- `src/lib/smartboard/lessonLines.ts` — when computing the next Lesson Line origin, use `structureBottom + rowSpacing` instead of `topY + intrinsicRows * rowHeight`.

### Algorithm (per Lesson Line)
1. Collect all rendered Lesson Objects on the line.
2. For each, compute intrinsic height from its tree (numerator + bar + denominator, radical body + index, matrix row count, etc.) — already partially done in `MathTreeRender`.
3. Cross-check against the live measured DOM rect (handles font swaps, italics, large operators) and cache the max.
4. `lineBottomY = max(object.top + object.measuredHeight)` for all objects on the line.
5. `nextLineY = lineBottomY + rowSpacingPx`.
6. Store on the LessonLine record so `PresentationView` cursor logic, Enter handler, and click-gate all use the same value.

### Cursor consequences
- Enter key, auto-advance on blue, and click-on-empty-row all snap to the next Lesson Line origin computed above.
- Click gate refuses any y that falls **inside** another Lesson Line's bounding box (no caret inside a fraction belonging to a previous line).

---

## Part 2 — Bounded Movement Rules

### 2A. Cursor (sensor) manual slack
- Allow the teacher to press ↓ or click below the auto cursor position by **at most 3 physical rows** (a "row" = one font-height unit from `grid.ts`, not a Lesson Line).
- Track `manualRowOffset ∈ [0, 3]` on the active Lesson Line; clamp on every move.
- Reset to 0 whenever a new Lesson Line is created or the active line changes.
- Cursor still cannot enter a completed Lesson Line unless that line was re-selected from the Lesson Presentation panel (already enforced — keep).

### 2B. Floating Number panel drag bounds
File: `src/components/smartboard/FloatingNumberPanel.tsx` + `presentation.ts`.

- Make the panel draggable on the Y axis (X stays anchored).
- **Upper bound**: `nearestCompletedLessonLine.bottomY + 3 * rowHeight`. Snap back if dragged higher.
- **Lower bound**: y immediately above the next **Lesson Section** heading (Example N, Exercise, Activity, Homework, Summary, Notes, Assessment, or any beat flagged `kind === "section"`). If no section follows, panel may drag freely through empty workspace.
- **Collision avoidance**: build a list of occupied rects (equations, prose, headings, diagrams, graphs, tables, math objects) from the rendered Lesson Lines; reject any drag position that intersects.
- **Auto re-settle**: subscribe to row-spacing, text-size, and lesson-edit events; if current y becomes invalid, animate to the nearest valid y preserving the 3-row clearance.

### 2C. Section detector
Add `isSectionBeat(beat)` in `src/lib/smartboard/presentation.ts` matching the list above (case-insensitive heading match + explicit beat-kind flag). Used by the Floating Number lower bound and by future features.

---

## Technical Notes (for reviewers)

- All math intrinsic-height work stays in `MathTreeRender.tsx` / `mathTree.ts`; `RowView` already welds structures — we add the **measured-bottom report upward** to `PresentationView`.
- Lesson-line bottom is cached per line and invalidated on: structure edit, font/text-size change, row-spacing change, lesson reload.
- Floating panel drag uses pointer events + `requestAnimationFrame` clamp; no layout shift since the panel is already an overlay (per the earlier bottom-panel decoupling work).
- Storage keys: `smartboard:cursorSlackV1`, `smartboard:floatingPanelY:<lessonId>` for persistence across reload.
- No backend or schema changes.

---

## Out of scope
- Horizontal drag of Floating Number panel.
- Re-flowing already-typed lines when row spacing changes mid-lesson (already handled by the recent Row Spacing work).
- Chemical-formula structures (listed as future support in the spec).
