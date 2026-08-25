## Technical notes

- `src/components/smartboard/PresentationView.tsx`
  - `BeatObjects` (line ~7180) is the pile. Replace its use for `problem` / `exercise-prompt` beats (line ~7293) with the existing `FlowingTextAndObjects` interleaving so objects slot in by `afterLine` against the question text lines. Keep a trailing group only for objects whose `afterLine` exceeds the line count.
  - `FlowingTextAndObjects` keeps its `afterLine` slotting but sorts with `sortByPlacement` (placement home first, then `afterLine`) instead of `afterLine` alone, so two diagrams sharing a line keep authored order.

- `src/lib/smartboard/presentation.ts`
  - `buildBeats` (line ~392): stop merging `solutionNotesObjects(b)` into the question beat's object bag. The question beat carries only the problem block's own objects plus non-solution blocks; solution diagrams reach the board through the reservoir note rows.
  - `notesOnlyRows` (line ~233): build rows from `parsedSolution` while tracking each row's source line index, then attach each diagram to the row whose line range contains its `afterLine`, instead of `rows[rows.length - 1].noteObjects = diagrams`. Diagrams before the first prose row get their own leading note-only row. Preserve current behaviour when there is no prose at all.
  - Highlight path (line ~490 / ~553) already attaches `noteObjects` per highlight — unchanged, apart from ordering through `sortByPlacement`.

- `src/lib/floating/solutionItems.ts`: `sortByPlacement` stays the single ordering law (`sectionKey` → `sectionOrdinal` → `afterLine`); no signature change.

- No schema change: placement data (`sectionKey`, `sectionOrdinal`, `afterLine`) is already persisted on the object JSON by `lessonOutline.renderSegmentBody`. Old notes without `sectionKey` fall back to `afterLine`, which is what they had before.

### Verification

Open the Smartboard for a note that has a diagram in Introduction, one mid-question in an Example, and one inside that Example's Solution, and confirm each renders at its authored line rather than in a bottom pile, with sibling order preserved.
