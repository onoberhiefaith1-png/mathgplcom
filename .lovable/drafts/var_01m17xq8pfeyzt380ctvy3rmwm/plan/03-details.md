## How Floating currently works (confirmed)

Two pages, one data record per activity:

- **Stage 1 — Floating Highlighting** (`src/pages/FloatingPreparationPage.tsx`, `/lesson-notes/:id/floating-prep/:subsectionId`): renders the solution and mints a permanent `uid` per highlight, autosaving `floating_highlights`.
- **Stage 2 — Floating Alignment / Numbers** (`src/pages/FloatingNumbersPage.tsx`, `/lesson-notes/:id/floating/:subsectionId`): one `FloatingWorkspace` block per `FloatingLine`, chips laid out with `flex flex-wrap`; saves `floating_lines` + `floating_bucket`.
- Identity is permanent: `sourceUid` (`src/lib/lessonnotes/lineIdentity.ts`) joins highlight → floating line → Smartboard (`src/lib/smartboard/presentation.ts` `buildReservoirs`, `previewIntegrity.ts`). Never positional. All floating columns live on the single `notebook_subsections` row for that activity, so activity scoping already holds.

## Technical changes

**Layout (the horizontal-strip bug)**
- `FloatingPreparationPage.tsx:960` — replace the per-line `whitespace-nowrap overflow-x-auto` wrapper with a wrapping block (normal whitespace, `break-words`, token spans stay `inline-block` so math atoms never split mid-structure). Token selection logic (`data-tok-key` ranges, `captureSelection`) is untouched, so highlights still work after wrapping.
- Keep the contained `overflow-x-auto` only around wide objects (`:951`, table/matrix/diagram cards) and give `FloatingWorkspace`/`EquationAtoms` rows `min-w-0` + wrapping so a long equation header wraps instead of stretching the page. Responsive check at tablet, laptop, desktop and Smartboard widths.

**Line-level controls (Stage 2)**
- New per-line control row inside `FloatingWorkspace` (or as a small overlay on the selected line in `FloatingNumbersPage`): Delete line, Duplicate, Copy, Paste, Move up, Move down, plus an Add line action for text lines. Table-derived lines keep their existing `TableWorkspace` ownership and are excluded from move/delete-into-table operations.
- Deleting a line clears its floating content but keeps the highlight intact (the highlight remains the source of truth for `sourceUid`); the row shows an empty "no floating numbers" state so nothing is hidden.
- Reordering writes an explicit line order in the saved payload so the sequence is the teacher's, not recomputed from array position at read time.

**Structure-preserving copy/paste**
- New `src/lib/lessonnotes/floatingClipboard.ts`: serialise a line to `text/html` carrying a `data-mathgpl-floating` payload (fillers, containers, arrangement, equation) plus readable `text/plain`, mirroring the approach in `structuralClipboard.ts`. Paste reads the structured payload when present; otherwise it tokenises plain text with `tokenizeMath` so terms and structures stay whole, routes structural macros to the Symbols row via the existing `sanitizeFillers`, preserves a leading `−`, and never injects a leading `+`.

**Teacher authority**
- Add `editedByTeacher?: boolean` (with `editedAt`) to `FloatingLine` in `src/lib/lessonnotes/floatingCompile.ts`; set it on every manual mutation (chip add/edit/remove, paste, delete, reorder, marks) and persist it in `floating_lines`.
- `generateAll` in `FloatingNumbersPage.tsx` merges instead of replacing: lines flagged teacher-edited keep their saved fillers/containers/arrangement, and the toast reports how many were preserved. Each such line gets an explicit "Regenerate this line" action that clears the flag for that one line only.
- Smartboard read path is unchanged — it already prefers saved teacher data and only falls back to derived chips when a subsection has none.

**Validation**
- Unit tests: wrapping-safe token rendering, clipboard round-trip (structured and plain-text paste, sign preservation), and a merge test proving Generate never overwrites a teacher-edited line.
- Manual acceptance run with the four-line quadratic example: vertical lines, no page-level horizontal scrollbar, delete + paste + save, then confirm the Smartboard shows the corrected structure and a second Generate leaves it alone.

## Out of scope

Smartboard presentation logic, highlight capture behaviour, AI generation prompts, and anything else in Lesson Notes.
