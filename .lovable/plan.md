# Restore and harden the floating-number pipeline to the Class Smartboard

## Verified current state

- The notebook the user linked to the class smartboard (`ADD`, `0ad6002e-5bfa-4c07-813b-da3bc3d69771`) has three example subsections.
- Every subsection has `floating_lines = []`, `floating_highlights = []`, and `floating_bucket = null`.
- The Smartboard `buildReservoirs` function therefore builds an empty reservoir and shows "no floating numbers" — the visible symptom is a downstream effect of empty data, not a rendering bug.
- `syncDocumentToNotebook` (triggered when the lesson opens) only initialises `floating_lines: []` when it creates a brand-new subsection. It does not overwrite an existing subsection's floating state, so the sync path itself is not wiping saved data. However, if the document's `doc_key` or normalised problem text drifts, the sync can insert a new empty subsection and leave the old one orphaned, which makes any previously saved floating lines unreachable.

## Root cause

The pipeline is broken at the point where floating chips are supposed to land in `notebook_subsections.floating_lines`. Either:

1. The teacher's floating-number preparation was never persisted to that column, or
2. A document re-sync created a new subsection and the old floating-bearing subsection became unreachable.

Because the Smartboard reads only the final `floating_lines` column and has no fallback when that column is empty, the result is the same in both cases: "no floating numbers".

## Plan

### A. Harden legacy subsection matching so floating state is not orphaned

Update `src/lib/lessonnotes/syncDocumentToNotebook.ts` so that before inserting a new empty subsection, it searches for an existing unclaimed subsection with the same `section_id`, same normalised problem text, and same kind. If one exists, claim it (update its `doc_key` and `order_index`) and preserve its `floating_lines`, `floating_bucket`, and `floating_highlights`. Only if no match exists should a new empty row be inserted.

Also, after the sync completes, delete or archive any subsections in the same section that were not claimed by the current document parse and are not referenced by `notebook_blocks`. This prevents old floating-bearing rows from being left behind while new empty rows are used for teaching.

### B. Add a deterministic solution-derived fallback in `buildReservoirs`

In `src/lib/smartboard/presentation.ts`, when a question has no teacher-curated floating data (`!highlights?.length && !rawLines?.length && !bucket?.fillers?.length`) but its solution block contains typed equations, derive one reservoir line per non-empty solution equation using the existing `fillersFromEquation` and `detectStructures` helpers. This fallback is scoped to the current question's solution and uses only the helpers that already exist in the codebase.

This is a safety net, not a redesign of the Floating Numbers page. Teachers can still override the fallback by preparing chips on the Floating Numbers page; curated data always takes precedence. The fallback guarantees that a solved question never reaches the Smartboard with zero floating chips.

### C. Add logging and regression coverage

- Add console warnings in `buildReservoirs` when the fallback is triggered, so future debugging can distinguish curated data from fallback data.
- Add a unit test for the fallback path covering a simple arithmetic equation like `2+2+2`.
- Add a Playwright regression test that launches the class smartboard for a lesson with a solved example and verifies that floating chips are rendered, not the "no floating numbers" placeholder.

### D. Verify the fix end-to-end

- Typecheck the project.
- Run the new unit test and the Playwright regression against the `ADD` notebook scenario.
- Confirm that existing floating-prepared lessons still render their curated chips verbatim (no fallback substitution).

## Out of scope

- No changes to the Floating Numbers preparation UI.
- No changes to the selection-law semantics for curated highlights.
- No new backend tables or edge functions.
