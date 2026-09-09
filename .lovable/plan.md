Hide the numerical zoom percentage when the timer is active

Goal
Fix the Smartboard top-bar overflow on narrow screens when a timed question is active. The timer is more important than the zoom percentage, so hide the percentage label when the timer is on; bring it back when the timer is off.

Change
1. In `src/components/smartboard/PresentationView.tsx`, update the compact zoom control group around line 7747–7771.
2. Keep the `−` and `+` buttons visible at all times.
3. Conditionally render the middle reset/percentage button:
   - When `timer.active` is true, render only `−` and `+` (no percentage text).
   - When `timer.active` is false, render `−`, the reset button showing `{Math.round(zoom * 100)}%`, and `+`.
4. Preserve all existing `aria-label`, `title`, styling, sizing, and `mobileStudent` classes. The reset button continues to reset zoom to 100% when present.

Validation
- `bunx tsgo --noEmit` passes.
- Focused Smartboard/touch UI tests still pass.
- Preview shows the zoom percentage absent during timed questions and present otherwise.
