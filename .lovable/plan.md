# Presentation Flow Upgrade

Refines the existing Smartboard so the lesson note drives the rhythm. No changes to how floating numbers are generated — only how they are ordered, consumed, and interleaved with notebook explanations.

## 1. Preserve original creation order
- File: `src/lib/smartboard/presentation.ts`
- In `buildReservoirs`, stop calling `shuffleLine(...)` and stop applying `rearrangeStream` / `applyArrangement`. Use the fillers exactly as the teacher created them.
- In `src/lib/lessonnotes/floatingCompile.ts`, keep `arrangement` data for backwards compatibility but make `compileBucket` emit `viewCombined` in original order (no rearrangement) for new presentations.

## 2. Continuous rotation queue
- File: `src/components/smartboard/FloatingNumberPanel.tsx` (and the parent state in `PresentationView.tsx`).
- Replace the "used → hidden" model with a rotating queue:
  - When a chip is selected, mark it `used` and move it to the back of the queue (or a "used" bucket).
  - When every chip in the active reservoir is `used`, reset all to `available` automatically.
- Persist the rotation per-subsection so navigating beats keeps state.

## 3. Highlighted vs unhighlighted content (already modelled, enforce strictly)
- Lesson notes already separate highlighted floating lines (`floating_lines`) from prose (`precedingNotebook`).
- Audit `presentation.ts` so:
  - Only highlighted equations become reservoir lines / fillers.
  - All other prose becomes "Notebook N" entries (never tokenised into chips).

## 4. Presentation flow (intro → objectives → explanation → example)
- `buildBeats` already emits text beats then problem beats. Verify ordering matches lesson-note section order and that example beats show only the question (already true — `kind: "problem"`, no solution beats pushed).

## 5. Notebook checkpoint behaviour
- File: `src/components/smartboard/PresentationView.tsx`
- A reservoir line with a `notebook` string becomes a checkpoint:
  - Before the line's fillers become selectable, surface a prominent Notebook icon and **freeze the floating panel** (disable chip selection + visually dim).
  - Clicking the icon reveals the prose exactly as stored (no AI rewriting) in-place above/beside the current solving row.
  - After dismissal, chips unfreeze and solving resumes.
- Re-use existing `notebookRevealIdx` / `shownNotebookIdx` state; add a `frozen` flag wired into `FloatingNumberPanel` to block `onSelect`.

## 6. Fancy notebook icon
- New component: `src/components/smartboard/NotebookCheckpoint.tsx` — a larger mini-notebook SVG with a subtle pulse/badge ("Teaching note"), sized ~1.6× current icon, positioned at the line gutter so it never overlaps math.

## 7. Cursor movement limit (±3 rows ahead)
- The presentation cursor tracks the most recently completed equation row (`activeRowIdx`).
- Allow navigation only to `activeRowIdx + 1 … activeRowIdx + 3`. Block clicks/keys beyond that.
- Implement in `PresentationView.tsx` where row focus is set; clamp focus index and ignore out-of-range jumps.

## Technical notes
- No DB schema changes; everything is presentation-layer.
- Floating Number generation pipeline (`FloatingNumbersPage`, `floatingCompile`) keeps writing the same shape; we only change *consumption*.
- Add a small unit test in `src/test/` to confirm `buildReservoirs` preserves filler order and that the rotation queue resets when exhausted.

## Out of scope
- No changes to AI generation prompts.
- No changes to assessment grading.
- No new backend tables or edge functions.

Ready to implement on approval.
