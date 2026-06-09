# Floating Number Highlight Persistence Fix

## What's actually happening

Highlights are *already* stored as lesson data (on the subsection row, in `floating_highlights` + `floating_lines` + `floating_bucket`). The bug is not that they aren't saved — it's that **other code paths destroy and rebuild that row and fail to carry the highlight forward**, so the selection silently vanishes on navigation/refresh.

Two weak links cause the loss:

### 1. The lesson-note sync wipes and recreates every subsection

`src/lib/lessonnotes/syncDocumentToNotebook.ts` runs **every time the lesson note opens** (via `useNotebook`) and **every time the document is saved**. It:
- deletes ALL sections (cascading to subsections + blocks), then
- rebuilds them from the document, and
- re-attaches floating data **only when the new subsection's problem text matches the old one exactly** (normalized).

When that match fails — empty problem text, slightly edited problem, math/LaTeX normalization differences, or two subsections sharing a problem — the highlight data is dropped. This is why "open SmartBoard → return to Lesson Notes" and "refresh" lose highlights: returning re-runs the sync, which can't re-pair the row.

### 2. The Floating Numbers reload can't re-pair a selection

`src/pages/FloatingNumbersPage.tsx` reload reconciles persisted lines to highlights by `equation === payload` string equality only. Any drift drops the line (and its `fillersSelected` selection) and reseeds an empty one.

A secondary timing issue: chip toggles only autosave after a 500 ms debounce with no flush on unmount, so navigating away immediately after a click loses that click.

## The fix

Treat highlight state as permanent and make every rebuild/reload path carry it forward robustly. No database schema change is needed (columns already exist).

### A. Harden `syncDocumentToNotebook.ts`
- Build the floating-data preservation map keyed by normalized problem text **and** keep an ordered positional fallback list (Nth question subsection in document order).
- When rebuilding each subsection, resolve preserved floating data in priority order: (1) exact problem match, (2) positional fallback for the same question index, so edited/empty problem text no longer drops highlights.
- Never overwrite an existing subsection's floating fields with empty/null when preserved data is available — only an explicit teacher action may clear them.
- Skip rewriting a subsection's floating data entirely when nothing changed.

### B. Harden `FloatingNumbersPage.tsx` reload + saving
- In the highlight-mode reconciliation, when `equation === payload` fails, fall back to positional pairing (same index) so the line and its `fillersSelected`/`containersSelected` selection are preserved.
- Add a flush-on-unmount/navigation save (mirroring `FloatingPreparationPage`'s `flushHighlightState`) and flush before the "Back"/"Lesson Note"/Generate navigations, so a chip toggle made right before leaving is always persisted.

### C. Confirm toggle semantics (already correct, keep intact)
- Clicking a chip toggles `fillersSelected[i]` / `containersSelected[i]`; clicking the same chip again removes it. This is the only removal path and stays the only removal path. The compiled `floating_bucket.selected` (which the SmartBoard reads) is derived from this saved state, so SmartBoard and Lesson Notes share one source of truth.

## Validation
1. Open a floating-number workspace, highlight lines 1, 4, 7.
2. Navigate to SmartBoard, then back to the lesson note → 1, 4, 7 still highlighted.
3. Refresh the page → 1, 4, 7 still highlighted.
4. Click line 4 again → line 4 unhighlighted; 1 and 7 remain.
5. Refresh → 1 and 7 highlighted, 4 not.
6. Edit unrelated lesson-note text and re-open → highlights survive (positional fallback covers any problem-text drift).

## Technical notes / files touched
- `src/lib/lessonnotes/syncDocumentToNotebook.ts` — robust floating-data preservation (problem-match + positional fallback; never clobber with empty).
- `src/pages/FloatingNumbersPage.tsx` — positional fallback in reload reconciliation; flush-on-navigation/unmount save.
- No migration: `floating_highlights`, `floating_lines`, `floating_bucket` columns already exist on `notebook_subsections`.
- Scope is persistence/reattachment only — no change to highlight UI behavior, scoring, or grading logic.