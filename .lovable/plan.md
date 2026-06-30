# Math Layout Engine Upgrade

Four targeted rendering improvements. No interface redesign — only layout / settings additions.

## 1. Dynamic vertical spacing per lesson line

Today `Board.tsx` guesses row height from a heuristic (`asciiHint`) based on which node kinds appear. That gives stair-step heights but lets a tall structure (deep fraction, nested root, matrix) still collide with the next line.

Change: let each math row measure itself and report its actual rendered height; the line container reserves that height plus a comfortable margin above and below.

- Add a `LineMeasure` wrapper around the per-line `<MathRender>` (in `Board.tsx` and `PresentationView.tsx`) that uses a `ResizeObserver` on the inner content box.
- Replace the `asciiHint` heuristic with `minHeight = max(baseLineHeight, measuredHeight + topPad + bottomPad)` where `topPad`/`bottomPad` come from the new Lesson Line Spacing setting (see §2).
- Inside `MathTreeRender.tsx`, ensure structural nodes (`FracView`, `SqrtView`, nth root, matrix, large brackets, integrals, sums, stacked exponents) render with `display: inline-flex` and intrinsic top/bottom padding tied to their structural depth so the measured height already includes ascender/descender room. This removes the need to special-case node kinds in the parent.
- Apply the same measured-height contract to the Smartboard `Board` rows, the Presentation view rows, and the Notebook viewport. Each line becomes a flex row with `align-items: center` and `min-height: measured`.

Result: previous line → fraction → next line are always separated by the fraction's full bounding box plus the configured margin.

## 2. Lesson Line Spacing setting

Add a single CSS variable `--lesson-line-gap` driven by a new setting.

- Extend `SettingsSheet.tsx` (Smartboard) and the matching Lesson Notes settings panel with a new section "Lesson Line Spacing": preset chips Compact / Normal / Comfortable / Wide, plus a Custom slider (range 0–48 px).
- Persist as `lessonLineGap` in the existing settings store (same place `surface`, `profile`, `inkColorId` live).
- Apply by setting `--lesson-line-gap` on the board / document root; the line container in §1 reads it for `topPad` + `bottomPad`.
- Only affects vertical gap between lesson lines — no font, page or math-scale change.

## 3. Independent Text Size control

Keep the existing page Zoom (`workspaceZoom`) untouched. Add a parallel control that scales content only.

- New setting `textSize` (presets: S / M / L / XL + slider 0.8×–1.6×), persisted alongside the others.
- Drive a second CSS variable `--sb-text-scale`. Multiply the existing `--sb-eq-size` and prose font sizes by it: `font-size: calc(var(--sb-eq-size) * var(--sb-text-scale))`. Math glyphs, fractions, roots, exponents inherit because they already size in `em`.
- Do NOT touch the workspace transform, canvas width, margins, chrome, or settings panels. The page stays the same size; only the writing grows.
- Expose the control in the same settings panel as Lesson Line Spacing, clearly labelled "Text Size" with the existing Zoom kept separate and labelled "Page Zoom".

## 4. Placeholders disappear once filled

In `MathTreeRender.tsx` the dashed cube currently renders whenever a sub-row is empty. The required rule is per-slot: each placeholder vanishes as soon as that slot has any content, independently of its siblings.

- `RowView` keeps the dashed cube for a truly empty row (the slot has zero children).
- Remove any logic that shows a placeholder cube for a non-empty row, including the "first child is a power/sub" case currently handled around lines 127–171. Replace it with: render the row's children; render the dashed cube only when `row.length === 0`.
- For fractions: `FracView` renders numerator and denominator as two independent `RowView`s — each shows its own placeholder only while empty, so the example `12 / □` (top filled, bottom empty) works without any cross-slot coupling.
- Same rule applies to: `SqrtView` radicand, nth-root index and radicand, exponent base/superscript slot, subscript slot, matrix cells, large-bracket body, integral bounds and integrand, sum bounds and summand.
- Placeholders stay focusable as caret sensors (existing behaviour) but disappear visually the moment the slot becomes non-empty.

## Technical notes

- Files touched:
  - `src/components/smartboard/MathTreeRender.tsx` — placeholder rule, intrinsic structural padding.
  - `src/components/smartboard/Board.tsx` and the Presentation view's line container — replace `asciiHint` with measured height; consume `--lesson-line-gap`.
  - `src/components/smartboard/SettingsSheet.tsx` (and Lesson Notes settings panel) — add Lesson Line Spacing + Text Size sections.
  - `src/lib/smartboard/grid.ts` / theme module — expose `--lesson-line-gap`, `--sb-text-scale` defaults.
  - Settings persistence hook (same store as `workspaceZoom`).
- No business-logic changes, no schema changes, no AI prompt changes.
- Verification: Playwright snapshot of a line containing `(-b ± √(b²-4ac)) / 2a` followed by a prose line at each spacing preset; check that no bounding boxes overlap and that filled fraction slots show no dashed cube.
