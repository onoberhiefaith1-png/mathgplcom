# Smartboard polish: placeholders, dynamic √, line locking

Three targeted changes. No redesign. No layout shifts to unrelated areas.

## 1. Placeholder boxes disappear once filled

**File:** `src/components/smartboard/MathTreeRender.tsx`

Today the empty-row guard already hides non-active empty sub-rows. The boxes still visible in the screenshot (`2d □ □ □`, `-4ac □ )`) are coming from two extra sources:

- Empty *adjacent rows* of containers (e.g. extra `power`/`subscript` slots, `frac` denominator, `bracket` body) that the renderer still gives a visible `minWidth` to. We will treat them the same as inner empty rows: `opacity 0`, `minWidth 0`, `border none` when the cursor isn't on that exact path. Tap target stays (~0.18em invisible hit zone) so the teacher can still click to enter it.
- Stray literal `□` placeholder atoms emitted by `buildSlot`/`nodesToLatex` (`src/lib/floating/highlightEngine.ts`) when a structure is built with empty slots. These are persisted into the chip value and re-tokenised on the board as a real character. We will:
  - Stop emitting `□` literals — `emptyToSlot` and `nodesToLatex` should produce an *empty* row (no content) instead of injecting the box glyph. The renderer's empty-row UI is now the single source of truth for "this slot is empty".
  - In the smartboard tokenizer, ignore any legacy `□` characters when materialising a row so existing saved chips don't render stale boxes.

Result: an empty slot shows the dashed box only while the cursor is inside it; the moment the teacher types, the box vanishes because the row is no longer empty. Applies uniformly to fraction, sqrt, bracket, power, subscript, abs.

## 2. Seamless, expanding square root

**File:** `src/components/smartboard/MathTreeRender.tsx` (`SqrtView` only)

The radical tick is an SVG with a fixed viewBox; the overline is the body's `borderTop`. The seam in the screenshot is because the SVG's top edge doesn't meet the borderTop pixel-for-pixel and the SVG stops growing when the body wraps.

- Pull the overline off the body and draw it as a sibling `<span>` that sits on top of both the tick and the body, so a single 1.4px line spans `tick → body end`. The body keeps growing (it's already `inline-flex` + `useMeasuredHeight`), and the overline grows with it because it's `width: 100%` over the combined flex container.
- Use the same `useMeasuredHeight` value to set the tick SVG height, so the diagonal stroke meets the overline exactly at the top-right corner (no gap, no overshoot).
- Live expansion works because the body already re-measures via `ResizeObserver`. Confirm by typing inside `√(…)` — the overline lengthens in real time and freezes when typing stops (no extra logic needed; CSS flex handles it).

Brackets, fractions, abs already use `useMeasuredHeight` the same way — no changes needed there. They expand correctly today.

## 3. Line locking — cursor follows Presentation

**Goal:** only the line currently shown in Presentation Mode is editable. Clicking any other line is a no-op.

**Files:**
- `src/components/smartboard/PresentationView.tsx` — already owns the active row index (the one with the pulsing notebook checkpoint).
- `src/components/smartboard/SmartLineLayer.tsx` — renders each lesson line and wires pointer events.
- `src/hooks/useSmartBoard.tsx` (or whichever hook owns `setCursor`) — gate cursor moves.

Implementation:

1. Add `activeLineIndex: number` to the smartboard state, owned by `PresentationView`. It equals the line currently being presented (the line whose checkpoint is the latest unlocked one, or the line the teacher has scrolled back to via Presentation's up/down controls).
2. Pass `activeLineIndex` down to `SmartLineLayer`. Each rendered line receives `isActive = index === activeLineIndex`.
3. In every pointer handler that places the cursor (`RowView` root tap, trailing tap area, `RightEscape`, `NodeView` taps), wrap the `onCursorChange` call with an `isEditable` guard provided by the parent line. When `!isEditable`, swallow the event (`e.stopPropagation()`, `e.preventDefault()`) and do nothing.
4. When the teacher presses Next / creates a new line, `activeLineIndex` advances to the new line — previous line auto-locks (already the natural consequence of step 3).
5. When the teacher scrolls Presentation back to an earlier line, that line becomes `activeLineIndex` and instantly editable. No separate "unlock" gesture.
6. Optional toast on locked-line click: small inline hint `"Return via Presentation to edit this step."` Throttled, dismisses on next active-line click. Skip if it complicates the layout — silence is acceptable.

No styling changes — locked lines look identical, they just don't accept the caret.

## Out of scope

- Floating Number panel rotation logic (unchanged).
- Lesson-line pairing / notebook checkpoint flow (unchanged).
- AI assistant, voice input, geometry, tables, graphs (unchanged).
- Saved chip migration: a one-time read-side filter handles legacy `□` characters; no DB rewrite.

## Verification

1. Open the quadratic-formula smartboard from the screenshot. The trailing `□` boxes next to `2d` and inside `√(b²-4ac)` should be gone; an empty box only appears when the cursor is parked inside that exact slot.
2. Click inside the square root and type — the overline extends continuously with the content; no seam between tick and overline; when typing stops the size is preserved.
3. With three lines on the board, place cursor on Line 3, then click Line 1 — nothing happens, caret stays on Line 3. Scroll Presentation up to Line 1 — clicking Line 1 now places the caret there, and Lines 2/3 reject clicks. Press Next → Line 3 becomes active again, Line 1 locks.
