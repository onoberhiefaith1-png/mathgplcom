## Goal

Today one ▲/▼ control (the "line navigator" on the Floating Number panel) is doing two unrelated jobs:

1. Scrolling through floating-number sets / lines (and updating the blue "Used" strip).
2. Moving the writing cursor (sensor).

We split them into two completely independent controls, rebalance the left toolbar, and clean up two long-standing rendering inconsistencies (square root component reuse, placeholder cubes leaking onto the Smartboard).

---

## 1. Floating Number Scrollbar — keep, narrow its job

Edit `src/components/smartboard/FloatingNumberPanel.tsx` and `PresentationView.tsx`:

- Keep the existing ▲/▼ + line-number badge inside the Floating Number panel (left "grip column").
- It only:
  - moves between floating-number lines (`onPrevLine` / `onNextLine`),
  - rotates the 5-chip window,
  - updates the blue "Used" section.
- Remove every side-effect that currently nudges the writing cursor or `beatCursor` from these arrows. Any `setSensor` / `setLiveCursor` / `setManualFloatingLineIdx → cursor` linkage triggered by ▲/▼ on the panel is deleted.
- The current secondary "left-edge floating-line navigator" overlay in `PresentationView.tsx` (lines 2808-2880) that also drives `setManualFloatingLineIdx` is **removed** — its job is now exclusively the panel's own ▲/▼.

## 2. New dedicated Cursor Scrollbar

Create `src/components/smartboard/CursorScrollbar.tsx`. It is a vertical pill rendered on the **left side** of the smartboard (the slot freed up by step 4), styled to match the Floating Number grip but with:

- only two buttons: ↑ and ↓
- no line number, no page indicator, no floating-number index, no badge

Behaviour (all implemented in `PresentationView.tsx` via two callbacks `onCursorUp` / `onCursorDown`):

- ↑ moves the writing sensor up one editable row; ↓ moves it down one editable row.
- Press-and-hold auto-repeats (≈ 90 ms cadence after a 350 ms initial delay).
- Movement is run through the existing lesson-line gate (`lessonLines.ts` → `isClickAllowed`, `nextWritable` / `prevWritable`), so it:
  - never enters locked rows (question, heading, prose, notebook, completed equations, headers/footers),
  - never crosses out of the active beat / session,
  - obeys the existing 3-row manual slack (`autoFloorRef`) — attempts beyond ±3 rows from the automatic floor are ignored,
  - snaps `x` back to the master left margin on every move (consistent with Enter behaviour).
- It is a **manual override only**. Automatic cursor placement (after Enter, after structure insertion, on beat change) is untouched.

## 3. Left toolbar layout changes

In `PresentationView.tsx` (the left toolbar block at lines 3177-3320 and the "floating-line navigator" overlay at 2808-2880):

- **Keep on the left:** Undo, Redo, the new Cursor Scrollbar (↑/↓).
- **Move to the right toolbar** (`RightTools.tsx` or a new right-rail group adjacent to it): the three "middle controls" currently on the left — Previous Section (◀), Next Section (▶), Smart Line, plus the Dot/two-point-line tool that sits with them. (User listed three; we group the related four together so the rail still reads as one cluster. Confirmable.)
- **Untouched:** top bar (Back / Undo / Prev / Next), bottom Eraser, bottom `#` floating-number toggle, bottom panel.
- The left rail's 5-second auto-hide reveal stays for Undo/Redo. The new Cursor Scrollbar is **always visible** (it is a primary control, not chrome).

## 4. Expandable square root reuse in Floating Number generator

The lesson-note editor already renders an expanding √ (CSS `border-top` overline that grows with the radicand). The Floating Number generator currently renders its own variant.

- Locate the lesson-note √ component (under `src/lib/notebook/mathRender.ts` / `MathTreeRender.tsx`) and export it as a single shared `SqrtView` from `src/lib/notebook/mathRender.ts` (or a new `src/components/math/Sqrt.tsx`).
- Replace the Floating Number generator's local √ rendering (in `FloatingPreparationPage.tsx` and `FloatingDisplayStrip.tsx` / `floatingCompile.ts` render path) with that one component.
- Verify hover-sync, atom click-order, and chip generation still work (existing tests in `floatingHighlightEngine.test.ts`).

## 5. Placeholder cube (□) policy

Today empty slots inside √, fractions, scripts can render as a small dashed cube to guide editing. That is correct **only** in the Floating Number panel (editing template). It must never appear on the Smartboard (final presentation surface).

- In the shared math views (`MathTreeRender.tsx` `SqrtView` / `FracView` / `SupView` / `SubView`), accept a `mode: "edit" | "present"` prop.
- `edit` (Floating Number generator + lesson-note editor): keep the existing focused-slot placeholder.
- `present` (Smartboard `FreeWriteLayer`, `FloatingNumberPanel` chip rendering, any board mirror): render empty slots as truly empty — no cube, no dashed outline, but preserve the expandable structure (so `√(2)` shows just the bar over `2`, and an empty fraction renders as the bar with no boxes).
- Audit `assertDisplaySafe` / chip label paths so the cube glyph (`□`) inside payloads coming from AI/teacher input is stripped before it reaches the Smartboard.

## 6. Cleanups & persistence

- Remove the now-dead `manualFloatingLineIdx`/cursor coupling and the duplicated left-edge navigator overlay.
- Cursor Scrollbar holds no persisted state; it reads/writes through the existing `cursorRef` + `setLiveCursor` flow so reload recovery already works.
- No DB / edge function changes.

## 7. Verification

- Reuse `src/test/floatingSmartboardSync.test.ts`; add cases:
  - Cursor Scrollbar ↑/↓ skips locked lines, clamps at the 3-row slack window, and snaps `x` to the master left margin.
  - Floating Number ▲/▼ rotates the chip window and updates `usedSet` without touching the sensor.
  - `SqrtView` in `present` mode emits no `□`; in `edit` mode it does when focused.
- Manual check in the preview: open `/smartboard/...`, press the new ↑/↓ — cursor moves, floating-number window does not; press the panel ▲/▼ — chips rotate, cursor does not; insert a √ with empty radicand from the Floating Number panel — Smartboard shows a bare overline, no cube.

## Files touched

- `src/components/smartboard/PresentationView.tsx` (split controls, relocate three buttons, mount `CursorScrollbar`, remove duplicated overlay)
- `src/components/smartboard/FloatingNumberPanel.tsx` (drop cursor side-effects from ▲/▼)
- `src/components/smartboard/CursorScrollbar.tsx` (new)
- `src/components/smartboard/RightTools.tsx` (host relocated section/line/dot buttons)
- `src/lib/smartboard/mathTree.ts` + `MathTreeRender.tsx` (`mode: edit | present`, shared `SqrtView`)
- `src/pages/FloatingPreparationPage.tsx`, `src/lib/lessonnotes/floatingCompile.ts`, `src/components/lessonnotes/FloatingDisplayStrip.tsx` (use shared `SqrtView`, mode flags)
- `src/test/floatingSmartboardSync.test.ts` (extend)

## Out of scope

- No changes to top bar, eraser, `#` toggle, bottom panel, or automatic cursor placement logic.
- No backend / AI prompt changes.
