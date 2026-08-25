# Fix the Floating pipeline opening the wrong solution

## What is actually happening (verified against this lesson note)

The lesson note has these sessions in order: Introduction, Example 1 / Solution 1, Example 2 / Solution 2, Exercise 1 / Solution 1, Example 3 / Solution 3 (the one with the tables).

In the database the stored session rows for the same note are: `explanation` (leftover, empty), `introduction`, `example`, `example`, `exercise`, `example` (this last one is the table solution).

When "Floating" is clicked on a Solution heading, the app resolves which stored question the solution belongs to like this:

1. Match the question text above the Solution against stored question text.
2. If that fails, fall back to counting positions: "this is the 5th session in the document, so take the 5th stored session row".

For the table solution, the question above it has no plain text at all (its content is objects/tables), so step 1 is skipped and step 2 runs. Counting in the document gives position 5, but stored position 5 is the `exercise` row — because the stored list also contains a leftover `explanation` row at the front. So the page opens `Exercise 1`'s solution (the sin 35° working seen in the second screenshot) instead of the table solution.

The missing table is the same bug: the table objects are stored on the correct row, which was never opened.

## The fix

1. **Give every session and question a durable document key.** The sync layer already computes a deterministic identity for each session segment (session index + kind + ordinal). Store that key on the session and question rows when the note is saved.
2. **Resolve Floating by that key, never by counting.** Clicking "Floating" on a Solution heading looks up the question row whose stored key equals the key of the session that owns this Solution. One heading, one row, always the same row — regardless of leftover rows, kind changes, or empty question text.
3. **Tighten the text fallback.** The current fallback accepts a partial, either-direction substring match, which can silently land on a different question. It becomes an exact normalized match only, and is used solely when no key is present (older notes that have not been re-saved yet).
4. **Last-resort behaviour is safe.** If neither key nor exact text resolves, the workspace opens for the question row created for this exact heading rather than a guessed neighbour.
5. **Clean the leftover session rows.** The stale empty `explanation` row is removed by the same keyed reconciliation, so the stored list matches the document.
6. Same keyed resolution is used by the "Assign" and "Smart Card" actions on the Solution heading, which share the identical positional logic today.

## Result

- Floating on the table solution opens that solution, with its tables visible and highlightable.
- Floating on any other solution opens exactly that solution.
- Existing highlights and generated floating numbers stay attached to their questions.

## Technical notes

- Additive migration: `doc_key text` on `public.notebook_sections` and `public.notebook_subsections`, plus an index on (`section_id`, `doc_key`). No data loss, no policy change (existing notebook RLS/grants cover both tables).
- `src/lib/lessonnotes/syncDocumentToNotebook.ts`: write `doc_key` from `segmentHome`/outline identity for each parsed session and its question; match existing rows by `doc_key` first, then by exact normalized problem text, then by order — this replaces the current greedy kind-based claiming that produced the leftover row.
- `src/components/lessonnotes/extensions/SectionHeading.tsx`: `resolveSubsectionId` queries by `doc_key` for the owning session segment (computed with the same outline helper used by the sync), removing `locateIndices`-based positional resolution; `ensureSubsectionId` creates rows carrying the same key.
- `src/pages/FloatingPreparationPage.tsx` is unchanged — it already renders solution text plus `content_json` objects for the subsection it is given.
- Verification: re-save this note, confirm stored rows carry keys and the stale `explanation` row is gone, then open Floating from each Solution heading and check the content matches the note (table solution shows its tables).
