# Fix Line-1 Note Click + True Board Mirroring (No Top Strip)

## Diagnosis (confirmed in code)

1. **Why Line 1's note isn't clickable:** when Edit mode is active, a status strip (`AiEditWorkspace`) is rendered as a fixed pill at the top of the screen (top: 12px, z-index 80, up to 92% of screen width). It floats right over the top of the Presenter Preview list — exactly where Line 1 sits. It swallows the clicks. Line 2 is lower on the page, outside the strip, so it works. This is also the "smaller board at the top" you don't want.
2. **Why clicked items sometimes don't appear on the board:** when a selection is mirrored, the board is cleared first — but clearing resets the internal beat cursor to 0. The mirror then reads the note text before React has finished switching to the correct section, so it can read the wrong (or empty) section and silently write nothing. The 30ms wait is not reliable.
3. **Verification lies:** the check that confirms "note is on the board" returns success when the note text is empty — so a missing note passes as ✓.

## Fixes

### 1. Remove the top strip entirely (PresentationView.tsx, AiEditWorkspace.tsx)
- Delete the floating fixed pill from the screen. No overlay over the board or the preview — clicks always land on the preview items.
- The mirror logic it runs (clear → apply → verify) moves into a headless hook inside `PresentationView`, so mirroring still happens, just with no panel.
- Status (✓ shown / ✗ failed / fixing…) is displayed as a small inline badge on the clicked item itself inside the Presenter Preview — not on a separate panel, and nothing drawn over the smartboard except the mirrored content itself.

### 2. Make the mirror timing-safe (mirror.ts)
- Set the beat cursor first, then wait until the controller actually reports the correct section (poll up to ~600ms) before reading line data — instead of a blind 30ms wait.
- Only clear the board content (ink/free lines), without resetting the beat cursor to 0.
- If the live section data still isn't ready, fall back to the exact text captured from the preview item at click time (it's already there — as you said, the information is in the preview, so it must show).

### 3. Fix false-positive verification (PresentationView.tsx)
- `getBoardHasNoteFor` must return false when nothing was written, so a failed mirror is actually detected.

### 4. Step-by-step auto-rectify ladder (new: manualEdit/autofix.ts)
When a click is mirrored, verify it appeared. If not, run these steps in order, re-verifying after each:
1. **Retry** the same mirror after waiting for the section state to settle.
2. **Force section** — explicitly re-set the beat cursor and re-apply.
3. **Direct write** — bypass the lookup and write the preview's own text/equation straight onto the board.
4. **Board reset + rewrite** — clear ink fully and write again from the preview text.
- Each step updates the inline badge on the clicked preview item ("Fixing… step 2/4"), and the final result shows ✓ (green) or ✗ (red). Everything covered: notes, question lines, solution lines, floating-number `#` handles, section headers — all go through the same mirror + autofix path.

## Result
- Line 1's note (and every other item) is clickable — nothing overlaps the preview anymore.
- Clicking any item in Edit mode shows it on the main smartboard itself — no mini board, no extra panel.
- If something doesn't show, the app automatically walks the 4-step fix ladder until it does, and you see the progress right on the item you clicked.

## Files
- `src/components/smartboard/AiEditWorkspace.tsx` — remove floating UI; convert to headless mirror runner (or delete and inline into PresentationView)
- `src/lib/smartboard/manualEdit/mirror.ts` — timing-safe apply, no beat-cursor reset, preview-text fallback
- `src/lib/smartboard/manualEdit/autofix.ts` — new 4-step rectify ladder
- `src/components/smartboard/PresenterPreviewPanel.tsx` — inline status badge on clicked item
- `src/components/smartboard/PresentationView.tsx` — fix `getBoardHasNoteFor`, keep-ink-only clear, mount headless mirror