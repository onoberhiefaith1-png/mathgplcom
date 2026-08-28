# Permanent line identity: Highlighting → Generating → Preview → Smartboard

## What I confirmed in the code (the real cause)

The pipeline already *claims* to pair by identity, but the identity it uses is
itself positional, so it silently drifts:

- `src/pages/FloatingPreparationPage.tsx` (Highlighting) assigns
  `groupId: i + 1` from array position in `orderedHighlights`, renumbers again
  on every removal (`.map((h, i) => ({ ...h, groupId: i + 1 }))`), and
  renumbers a third time on load in `restorePersistedHighlights`
  (`nextRealId++`). So the "durable id" of a highlight changes whenever the
  teacher adds, deletes or reorders anything.
- Every note-only row is saved with the shared sentinel `groupId: -1`, so notes
  have no identity at all and can only be located by their neighbours.
- Highlighting's save (`saveHighlightState`) keeps generated lines by matching
  **equation text** (`activePayloads.has(line.equation)`), so two identical
  lines in one solution collide and a renumbered set drops/keeps the wrong rows.
- `FloatingNumbersPage` and `presentation.ts` then match `groupId` first — but
  because the ids were reassigned, the match lands on a different line, which is
  exactly the "Line 2 shows Line 4's chips" symptom.
- `repairShiftedFloatingLines` in `floatingCompile.ts` masks this with a text
  similarity heuristic that can itself move chips between lines.

So the fix is to introduce a genuinely permanent identity and remove every
text/heuristic/positional fallback around it.

## The fix

### 1. Immutable identity minted once at the Highlighting Page

Each highlight and each note-only row gets a permanent `uid` (a generated
string, e.g. `hl_<random>`) created the moment the teacher makes the selection,
plus the owning `questionId` (the subsection id). `uid` is never recomputed,
never derived from position, and survives add/remove/reorder and reload.
`groupId` stays on the record purely as a legacy display/order number.

Note-only rows lose the shared `-1` sentinel and get their own `uid`, so a note
is addressable in its own right.

### 2. Generating Page keyed by uid

Generated floating pieces are stored on `floating_lines` with
`{ questionId, sourceUid, lineId }`. Reconciliation on load matches `sourceUid`
only. No equation-text fallback, no positional fallback, no repair heuristic.
Lines whose `sourceUid` no longer exists are reported (see 4), never re-homed.

The AI generate call already sends highlight identity; it will send `uid` so the
returned pieces come back tagged with their own source.

### 3. Preview joins strictly by uid

`buildReservoirs` in `src/lib/smartboard/presentation.ts` builds one row per
highlight record in saved order, and attaches:
- the note from *that record's* own `precedingNotebook`, and
- the chips from the floating line whose `sourceUid` equals that record's `uid`.

A row with a note and no matching floating line stays note-only with zero chips
— never filled from another line. `repairShiftedFloatingLines` and
`findVerifiedFloatingLine`'s equation-text path are removed from this path.

### 4. Structural validation before Preview renders

A new `src/lib/smartboard/previewIntegrity.ts` checks, per question: every
floating line has an existing `sourceUid` in the same `questionId`; no uid is
claimed by two lines; no note is attached to a record it does not belong to.
On failure `SmartboardPreviewPage` shows a teacher-facing banner —
"Structure error: some floating numbers could not be matched to their original
line. Please review the generated values." — listing the affected lines, and
does not shuffle anything to hide it.

### 5. One-time backfill of existing notebooks

Old rows have no `uid`. On load, if a subsection's highlights lack `uid`, mint
uids in saved order and adopt the current `groupId`/equation pairing once, then
persist. After that the notebook is on the permanent scheme. This is done in
place, deletes nothing, and never runs twice.

### 6. Preview stays the single editable source of truth

`previewEdits.ts` writes edits back by `uid` (dropping its equation-text
fallback). The Smartboard and the Presenter view both continue to read the
same `buildLessonModel` output, so neither re-derives the note/chip pairing.

### 7. Regression tests

Added to `src/lib/smartboard/__tests__/`: reordering and deleting highlights
keeps each line's chips; duplicate identical equations in one solution keep
distinct chips; a note-only line stays chip-free; the quadratic case
`2x² + 5x − 3 = 0` maps Line 2 chips to Line 2 and Line 4 chips to Line 4;
invalid structures raise the validation error rather than rendering.

## Not changing

The Highlighting and Generating concepts, their UI, existing highlight/note
semantics, the prose-vs-math note law, marks/scoring, tables and diagrams.

## Technical notes

Files touched: `FloatingPreparationPage.tsx`, `FloatingNumbersPage.tsx`,
`lib/lessonnotes/floatingCompile.ts` (add `sourceUid`, delete the shift-repair
heuristic), `lib/smartboard/presentation.ts`, `lib/smartboard/preview/model.ts`,
`lib/smartboard/previewEdits.ts`, `pages/SmartboardPreviewPage.tsx`, plus new
`lib/smartboard/previewIntegrity.ts` and tests. `uid` lives inside the existing
`floating_highlights` / `floating_lines` JSON columns, so no migration is needed.
