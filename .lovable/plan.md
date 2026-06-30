# Teaching Flow & UI Refinement Pass

A coordinated update across the Relationship panel, Smart Graph, Floating Number generator, and Presentation engine so the app behaves as one synchronized teaching assistant.

## 1. Relationship Panel — conditional visibility
File: `src/components/lessonnotes/geometry-editor/RelationshipPanel.tsx` (+ parent wrapper that mounts it).
- Render `null` when `selectedParts.length === 0`. Remove the empty-state card.
- Parent layout reserves the slot only when selection exists, so the diagram expands when nothing is selected.

## 2. Multi-select accumulates
File: `src/components/lessonnotes/geometry-editor/SmartGeometryContext.tsx` (or the click handler in `GeometryDiagram.tsx`).
- Default click → additive toggle (`Set` add; click same part removes that one).
- Add explicit "Clear Selection" button in the Relationship panel header.
- Remove the existing "replace on click" behaviour. Shift/Ctrl no longer required.

## 3. Generic mode = full AI generation
File: `supabase/functions/relationship-ai/index.ts` + `RelationshipEditorSheet.tsx`.
- New prompt branches:
  - 1 selection → "Everything related to X": definitions, properties, rules, theorems, formulae, connections.
  - 2 selections → only joint relationships (perpendicular, parallel, distance, midpoint, AB-as-diameter, etc.).
  - 3+ → relationships treating the set as one context (triangle, cyclic quad, collinearity, etc.).
- Auto-call when Generic mode is active and selection changes (debounced); replace prior AI-sourced suggestions, keep teacher/pinned.

## 4. Apply mode = lesson-ready statements
Same edge function, separate branch.
- Output statements suitable for direct insertion (e.g. "AB is a diameter, so ∠ACB = 90° (angle in a semicircle).").
- Each item gets an "Insert into lesson" button in `RelationshipPanel` that pushes a paragraph/math block into the active TipTap editor.

## 5. Real graph-paper styling
File: `src/components/lessonnotes/math-tools/SmartGraphView.tsx`.
- Axes: 2 px solid foreground.
- Major gridlines every whole unit (≈0.6 opacity).
- Minor gridlines at 0.2-unit subdivisions (≈0.2 opacity) — labeled at 0.2 / 0.4 / 0.6 / 0.8 when zoom permits.
- Same vertical + horizontal treatment. Off-white paper background.

## 6. Floating-number token fidelity
Files: `src/lib/floating/atoms.ts`, `src/lib/floating/highlightEngine.ts`, `src/lib/smartboard/floatingExtractor.ts`.
- Bug: highlight "a = 5" yields only "a =". Fix the trailing-token trim that drops the final atom when the highlight ends on a number adjacent to whitespace.
- Add unit tests in `src/test/floatingExtractorBackend.test.ts` covering `a = 5`, `x = -3`, `y = 2x + 1`.

## 7. Remove horizontal scrollbar on question
File: `src/components/smartboard/PresentationView.tsx` (and the question header inside `FloatingNumberPanel.tsx`).
- Replace `whitespace-nowrap overflow-x-auto` on the question container with `whitespace-normal break-words`. Match the lesson-note paragraph styles.

## 8. Fancy Notebook icon
File: `src/components/smartboard/NotebookIcon.tsx` (new) used by `FloatingNumberPanel.tsx` / `PresentationView.tsx`.
- Custom SVG: spiral-bound notebook with bookmark ribbon and visible lines. Tooltip "Read Lesson Note". Slightly larger; existing pulse animation kept.

## 9. Mini Rigid Teaching System (cursor window)
File: `src/components/smartboard/PresentationView.tsx`.
- Track `solvedLineIndex`. Allowed lines = `[solvedLineIndex+1, solvedLineIndex+3]` (max 3 ahead).
- Navigation keys / clicks beyond range are blocked with a toast.
- When line `n` is marked solved, window slides to `n+1 … n+3`.

## 10. Floating numbers pause on explanation-only rows
File: `src/components/smartboard/PresentationView.tsx` + `FloatingNumberPanel.tsx`.
- Classify each row: `hasHighlights` vs `explanationOnly`.
- On explanation-only rows: blur floating-number layer, set `frozen=true`, force Notebook pulse. Only after teacher opens Notebook + dismisses does the engine advance.

## 11. Row-based lesson interpretation
File: `src/lib/smartboard/presentation.ts`.
- Rebuild plan as ordered rows, each `{ highlightedTokens[], explanationNodes[] }`.
- Allow rows with empty `highlightedTokens` (pure explanation).
- Downstream consumers updated to iterate rows instead of one flat fragment list.

## 12. Notebook preserves lesson layout
File: `src/components/smartboard/NotebookOverlay.tsx` (or equivalent).
- Render the original TipTap JSON of the row's explanation (paragraph, spacing, math nodes) instead of plain-text join. Reuse the lesson-note read-only renderer.

## Out of scope
- No backend schema changes.
- No changes to authentication, classes, or assessments.
- No changes to floating-number law engine beyond the token-preservation bug.

## Verification
- Vitest: floating extractor cases.
- Manual: select 1/2/3 atoms on a diagram and confirm Generic+Apply outputs differ; verify graph paper styling at multiple zooms; reproduce "a = 5" highlight; presentation walkthrough across explanation-only and mixed rows.
