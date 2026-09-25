# Keep manually prepared Floating Numbers + add a Save button

## What goes wrong
Floating Numbers you prepare by hand are stored on each question's saved row, not inside the note text. When the note saves, it matches each question in the note to its saved row. If the match fails (for example because the question's position key changed after the recent "Solution under the question" fix), the old row is deleted and a new empty one is created — so the "#" and floating numbers vanish. This is a data-matching loss, not a display problem. The exact trigger will be confirmed against your note before the fix.

## What will change
1. **Floating Numbers never get wiped by saving**
   - When a question's saved row can't be matched by its key, fall back to matching by the question text (and then the solution text) before giving up.
   - Before any unmatched row is deleted, its prepared Floating Numbers are carried over to the new row for the same question.
   - A save that would erase preparation from a question that still exists is blocked.
2. **Save button at the top** — next to Select Flow and Present. Clicking it saves the whole note immediately and shows "Saving…" / "Saved".
3. **AI Edit output** — when AI Edit produces solutions, it keeps any preparation already on matching questions instead of starting blank.

## Checks
- Investigate your current note first: confirm which rows lost their floating numbers and why.
- Tests: prepare floating numbers → edit/save → reload → still there; move a Solution level → still there; AI Edit Proceed → preparation kept.
- Open the note in the preview, save, leave, return, confirm "#" and numbers remain.

Numbers already lost earlier cannot be recovered automatically unless an older copy still holds them.

## Technical details
- `src/lib/lessonnotes/syncDocumentToNotebook.ts`: add problem/solution-text fallback matching for subsections whose `doc_key` changed; transfer `floating_lines/bucket/highlights/scoring` from rows about to be deleted to their replacements (reuse `planFloatingHydration`); never insert `floating_lines: []` over a matched question.
- Lesson note editor header: add Save button calling the existing save/sync path with a forced flush; reuse `SaveStatusPill`.
- `persistGenerated.ts`: preserve existing floating data on matched questions.
