# Fix: All Typing Landing on One Row + Duplicate Scroll Arrows

## Root cause found (real diagnosis, not a guess)

**Bug 1 — everything writes to one line.** `insertTextAtSensor` in `PresentationView.tsx` is wrapped in `useCallback(..., [])` with an **empty dependency list**. That freezes it with the very first render's copy of `editActive` — and that frozen copy remembers the sensor's *original* line forever. So every write routed through it (Present-mode chip clicks, floating-number inserts, AI writes) ignores where you moved the sensor and stacks onto that one frozen row. This is exactly why "x = …, = …, x = −b" all pile onto a single line.

**Bug 2 — duplicated up/down arrows.** Two sensor controllers are rendered at once: the left-rail `CursorScrollbar` (re-added in a recent fix) and the `SensorDPad` (the permanent sensor controller). Both do up/down — that's the duplicate you keep seeing come back.

**Why the errors keep repeating.** Each past fix added another parallel write path instead of one shared one; the frozen callback silently re-broke whichever path was "fixed" last. The cleanup below removes the parallel paths for good.

## Changes (all in `src/components/smartboard/PresentationView.tsx`)

1. **Live sensor dispatch (the real fix).** Store the current `editActive` and `insertIntoActiveBox` in refs updated every render. `insertTextAtSensor` stays stable (so the AI controller doesn't churn) but always calls the *live* editor — writes land exactly on the sensor's current line, every time.
2. **Make `insertFractionAtSensor` use the same live dispatch** so fraction chips also always follow the sensor and never go stale.
3. **Remove the duplicate scroller.** Delete the left-rail `CursorScrollbar` block (and its import); the `SensorDPad` remains the single sensor controller — up/down/left/right in one place.
4. **Code cleanup.** Remove the now-dead `relocatedWriteRow` helper and any leftover unused imports from previous rounds so no stale path can resurrect this bug.

## Verification

- Typecheck, then drive the Present view with Playwright: move the sensor to line A, type, move to line B, tap a floating-number chip — confirm each write appears on its own sensor line, and confirm only one up/down control renders.
