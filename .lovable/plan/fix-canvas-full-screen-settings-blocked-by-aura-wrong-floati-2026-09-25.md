# Fix: Canvas full screen, Settings blocked by Aura, wrong floating numbers

## 1. Canvas full screen (top priority)
With Aura and Flow off, choosing a Canvas still does not fill the screen.

Likely causes (to be confirmed by reproducing first, in a real browser session on your lesson):
- Full screen is requested after the click has "expired" (it runs after the Canvas menu closes and the picture loads), so the browser silently refuses it.
- The picture is placed inside the Smartboard area, so it only fills that area, not the screen.

Fix:
- Ask for full screen directly inside the Canvas click itself (the same moment you press it), on the Smartboard area.
- Make the picture layer fill the whole screen once full screen is active, and stay steady while moving between slides.
- If the browser still refuses, show a small "Tap for full screen" button instead of failing silently.
- Keep the agreed layer order: picture below Flow, controls above Flow.

## 2. Settings blocked when Aura is on
The Aura button sits on the same layer as the top panel, so it captures your clicks on Settings.
- Put Aura on its own lower layer and move it clear of the top panel, so Settings (text size etc.) always works with Aura on.
- Flow animation keeps its own separate layer; neither covers the top panel.

## 3. Floating numbers from another question (not acceptable)
- Open your current lesson note and trace which question each set of floating numbers is saved against.
- Find where the mix-up happens. Suspects: the matching that restores saved floating numbers by question text (two similar questions can swap), and the step that copies preparation from an original note.
- Fix the pipeline so floating numbers are only ever matched by the question's own permanent ID; text matching may only be used when it is unique and unambiguous, otherwise nothing is copied.
- The Smartboard refuses to show floating numbers whose owner question does not match the question on screen (existing structure check, extended to cover this case).
- Repair the affected question in your note and add tests that reproduce the swap.

## Verification
- Real-browser check: Canvas fills the screen, Esc exits cleanly, slides move steadily.
- Settings clickable with Aura on.
- Each question on your lesson shows only its own floating numbers.

## Technical details
- `CanvasFullscreen.tsx` / `SlidePlayer.tsx`: move `requestFullscreen` into the click handler that opens the canvas (pass a flag or call from `presentCanvas`); use viewport sizing when `document.fullscreenElement === smartboardRoot`.
- `AuraLauncher.tsx` (z-[69], bottom-right) and Aura cockpit: lower z-index below Smartboard top bar; verify the top-bar Settings z-index.
- `syncDocumentToNotebook.ts`, `hydrateFloatingFromOrigin.ts`: problem-text fallback only when exactly one candidate matches; `previewIntegrity.ts` `cross_question` check applied at render time.
