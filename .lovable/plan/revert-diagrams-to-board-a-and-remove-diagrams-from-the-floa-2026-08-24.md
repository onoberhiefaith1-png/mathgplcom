# Revert diagrams to Board A, and remove diagrams from the Floating Numbers page

## What changes

1. **Diagrams, tables and graphs return to Board A (the main teaching board).**
   The last change moved every captured object off the teaching board onto Board B.
   That is undone: each beat renders its own objects inline again, in its section
   and in its original lesson-note order, with board zoom applied as before.

2. **Board B stops owning lesson objects.**
   Board B goes back to what it was before this change: the Calculator,
   Conversion and the blank companion page. It no longer mirrors the section's
   diagrams/tables. The section-sync work (stable `sectionId`/`sectionLabel` on
   each beat) stays, since it is harmless and keeps both boards on the same
   lesson position.

3. **Diagrams never appear on the Floating Numbers page.**
   Today a diagram in a solution is carried into the floating page as attached
   "note object" content. That pathway is closed: the floating page shows only
   floating-number lines and their text/table note content. Diagrams stay in the
   Lesson Note and on the Smartboard (including the Notes reveal and the Geometry
   Properties page) — they are simply not part of the floating-number workflow.

Nothing about diagram identity, Geometry Properties authoring, or the Smartboard
property test changes.

## Technical detail

- `src/components/smartboard/PresentationView.tsx` — restore inline object
  rendering in `BeatBlock`/flowing text; stop passing lesson objects into
  `InteractiveBoard`, keep it as the tools/companion surface.
- `src/components/smartboard/InteractiveBoard.tsx` — drop the "Section objects"
  tab and the `objects` prop; keep Calculator, Conversion, Companion page.
- `src/lib/smartboard/boardAssignment.ts` — no longer used for routing lesson
  objects; delete it to avoid a dead second source of truth.
- `src/pages/FloatingNumbersPage.tsx` — filter diagram-family objects out of
  `leadingNoteObjects` and per-line `noteObjects` (keep tables), so no diagram
  card can render there.
- `src/lib/smartboard/presentation.ts` — unchanged (`sectionId`/`sectionLabel` kept).

If you would rather roll back the whole message instead of a targeted revert,
the revert button on that chat message restores the exact previous state; this
plan is the targeted version plus the new floating-page rule.
