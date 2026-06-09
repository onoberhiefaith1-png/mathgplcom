# Floating Number System — Visible 3-Zone Conveyor

## Goal
The conveyor logic and the state-driven Check Line already exist, but the three zones are not visually distinct, so used numbers look invisible until you scroll. This makes the three zones always clearly visible and styled per your spec, keeps the conveyor + Check Line behavior, and scales to 50+ numbers.

## Zone layout (per active line)

```text
   USED (mint green)        ACTIVE (white, 5 max)        UPCOMING (light grey)
 ┌──────────────────┐  ┌───────────────────────────┐  ┌──────────────────────┐
 │  2x   =          │  │  ◀ [11] [-] [5] [÷] [3] ▶ │  │  7  +  9  4  8  1 …  │
 └──────────────────┘  └───────────────────────────┘  └──────────────────────┘
```

- **Used zone (left):** mint green background, numbers shown at slightly reduced opacity, still clickable to undo (returns the number to Active). Always visible whenever at least one number is used — no scrolling needed to see what's been used.
- **Active zone (center):** white background, exactly up to 5 working numbers, in the board ink color. Tapping one inserts it on the board and sends it to the Used zone.
- **Upcoming zone (right):** light grey background, dimmed, shows the not-yet-used numbers waiting to flow in. Not directly tappable.

## Conveyor behavior (already works — kept and verified)
When a number is tapped in Active: it moves to the Used zone, the remaining numbers shift left, and the next Upcoming number slides into Active so the student always sees 5 when available. Undo by tapping a Used number returns it to Active.

## Forward / Backward navigation
- **Forward** ▶ moves the Active window toward Upcoming numbers.
- **Backward** ◀ moves the Active window back toward earlier numbers.
- Because the Used and Upcoming zones are always on screen, the student can see used/remaining state at a glance and does not need to scroll just to find used numbers (this is the core fix for "used numbers invisible until I press forward").

## Scalability (5 → 50+ numbers)
- Active is always capped at 5.
- The Used and Upcoming zones get a fixed max width with horizontal overflow, so a line with 50 numbers stays compact instead of stretching off-screen. State (used vs available) stays readable at any count.

## Check Line logic (already state-driven — kept, minor wording)
Each number carries a used/unused state (the tap is the proof), so Check Line does not rely on equation re-parsing for usage:
- **Incomplete:** any required number still unused → toast `⚠ Line N incomplete — Unused floating numbers: <glyphs exactly as shown in the strip>`. No grading.
- **Incorrect:** all numbers used but arrangement invalid → toast `Error in your solution — Please check your arrangement.` (wording aligned to spec).
- **Correct:** all used + valid arrangement → green success, score added, advance to next line.

## Green side markers
The per-line left/side status bulbs were already removed; the top progress tracker (and the assessment tick row) remains the single source of completion status. This plan verifies no per-line side markers remain on the board.

## Color choice
Used zone uses **mint green** (first option in your spec). Easy to switch to light brown later if preferred.

## Technical details

### `src/components/smartboard/FloatingNumberPanel.tsx`
- Wrap the **Active** chips in a white rounded container (currently transparent).
- Restyle the **Used** zone container from muted grey to mint green (e.g. `#d1fae5` bg, `#6ee7b7` border, dark text) and apply slight opacity to used chips; keep the existing `onUnuse` tap-to-return.
- Give the **Upcoming** zone a light grey rounded container (e.g. `#f3f4f6`) instead of only dimming text; keep it non-interactive.
- Add `maxWidth` + `overflowX: auto` to the Used and Upcoming containers for scalability; Active stays exactly `WINDOW_SIZE` (5).
- Keep the existing `allSlots` (unconsumed) / `usedSlots` (consumed) derivation, `handleActiveTap` (insert + `onUse`), `handleUsedTap` (`onUnuse`), and the ◀/▶ offset logic unchanged.

### `src/components/smartboard/PresentationView.tsx`
- No logic change to the conveyor wiring (`onUse`/`onUnuse` → `consumedAbsIdx`) or Phase-1 usage check.
- Update only the Phase-2 incorrect-answer toast text to `Error in your solution` / `Please check your arrangement.`
- Confirm no remaining per-line side markers render (already removed at the former bulbs block).

## Verification
- Open a guided line: Used zone empty, Active shows up to 5 (white), Upcoming shows the rest (grey).
- Tap a number: it appears on the board, moves to the mint Used zone immediately (visible without scrolling), and the next Upcoming number slides into Active.
- Tap a Used number: it returns to Active.
- With a line of many numbers (10–50), zones stay compact and scroll within themselves; Active still shows 5.
- Check Line with one number unused → `⚠ Line N incomplete — Unused floating numbers: …` listing the exact glyph(s).
- Check Line with all used but wrong arrangement → `Error in your solution`.
- Check Line all used + correct → green success and advance.
- No green markers beside lines; top tracker shows progress.
