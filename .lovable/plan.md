
## Smart Sensor Control System

Rebuild the writing-sensor behavior on the Smartboard so it is *automatic by default, manually adjustable by the teacher, and bounded by intelligent restrictions*.

---

### 1. Tighten the default sensor position

In `PresentationView.tsx`, the "Solution open" anchoring effect currently drops the sensor 3+ rows below the "Solution" caption because `captionLines` reserves extra space and `firstEmptyBandRow` further skips ahead.

Change: when the Solution band is first opened and contains no ink, place the sensor exactly one writable row below the "Solution" heading row (heading row + 1), at `x: 0` (master left margin). Only if that row is covered by a tall structure or note does it fall through to the next empty row.

---

### 2. Permanent Sensor Controller (D-pad)

Replace the current `CursorScrollbar` (▲/▼ only, in the left rail) with a new **`SensorDPad`** component fixed at bottom-center of the viewport, visible whenever Floating Number mode is active (`panelOpen === true`).

Layout:

```text
        ▲
   ◀    ●    ▶
        ▼
```

- Rendered via `createPortal` as a fixed viewport overlay (same pattern as `FloatingNumberPanel`).
- Bottom-center, above the bottom drawer, in a `data-sb-chrome` container so it survives zoom/filter scaling.
- Press-and-hold auto-repeat (reuse the hold/repeat logic already in `CursorScrollbar.tsx`).
- Center `●` renders as a disabled/decorative dot, reserved for future use.
- Only responsibility: move the sensor. It never changes the active floating-number line.

The old left-rail ↑/↓ scrollbar is removed (or hidden when the D-pad is active) to avoid two controllers competing.

---

### 3. Four-direction manual movement

Extend `nudgeCursor` in `PresentationView.tsx` from `up/down` to `up/down/left/right`:

- **Up / Down** — use `findNextWritableEmptyRow` to jump to the next allowed row (skips ink, notes, structure-covered rows, restricted rows).
- **Left / Right** — nudge `sensor.x` by one grid column (`grid.COL_WIDTH`) inside the current row, clamped to the row's writable extent. Right stops at the row's ink boundary or the right margin; Left stops at the master left margin (`x: 0`).

All four movements clear `activeSensorLogicalIdxRef` set-once state and mark the move as manual (`manualPushedRef`).

---

### 4. Restricted-area model

Introduce a single predicate `isSensorAllowed(row, x)` used by every movement path (D-pad, auto-advance, click, arrow keys):

Blocked when the target row/point falls in any of:
- Question / Heading / Caption rows (`notebookRowLines`, section headings, "Solution" caption).
- Prose / narration rows (already tracked via `notebookRowLines`).
- Rows containing ink from a *completed* Lesson Line (see §6).
- Rows visually covered by a tall structure above (existing `rowCoveredByStructure` helper).
- The Floating Number panel's safety buffer (see §5).
- Any row outside the active beat's working area.

If the D-pad requests a blocked cell, the sensor **does not move** (no jump-over). Up/Down variants that already jump-over via `findNextWritableEmptyRow` retain that behavior — the block only stops motion when *every* row in that direction inside the working area is blocked.

---

### 5. Floating Number safety buffer

The Floating Number panel is a fixed viewport overlay, so its "row footprint" is computed by projecting its DOM rect back into board-grid coordinates once per render (via a `ResizeObserver` on the panel, reported through context/prop).

`isSensorAllowed` rejects any row within `panelTopRow - 1 … panelBottomRow + 1`. Moving toward the panel stops one row before the buffer; the teacher must drag/reposition the panel to reclaim that space.

---

### 6. Completed Lesson Lines lock automatically

Add a `completedLessonLines: Set<number>` (physical row ids) in `PresentationView.tsx`.

A Lesson Line is marked completed when the sensor **leaves** it — either:
- Enter / auto-advance to the next line, or
- Any D-pad movement that changes the row.

Once a row is in `completedLessonLines`, `isSensorAllowed` treats it as restricted. Ink on that row is no longer editable via sensor placement or click.

Persistence: mirror the existing `sensor`/`beat` persistence so completed rows survive reload for the active beat.

---

### 7. Reopening a previous Lesson Line via Floating Number

The only way to unlock a completed Lesson Line is to make it the active Floating Number line:

- When `manualFloatingLineIdx` (or `floatingLineIdx`) changes, resolve which physical row that line's equation occupies (already computed via the `lineMap` and `writeProseLineOnBoard` bookkeeping).
- Remove that row from `completedLessonLines` and place the sensor at that row's end.
- Selecting a different floating line re-locks the previously reopened row.

Click on the board for a locked row remains a no-op (existing click gate).

---

### 8. Floating Number always starts at Line 1

In the effect that initializes the floating panel when `panelOpen` flips true (or when the beat changes), force `manualFloatingLineIdx = 0` and `floatingLineIdx = 0`. Do not restore a persisted non-zero line for the "just opened" case.

The teacher navigates forward manually via the panel's existing ▲/▼ controls.

---

### 9. Automatic behavior preserved

Everything already working stays:
- After Enter or completing a matching line, the sensor auto-advances via `findNextWritableEmptyRow`.
- After a notebook note is written to the board, the sensor lands directly below it.
- Structure-aware skipping (fractions, radicals, matrices) is unchanged.

The D-pad is *additive* — it does not replace auto-placement, only lets the teacher override it inside allowed empty space.

---

### Technical summary (files touched)

- **New**: `src/components/smartboard/SensorDPad.tsx` — fixed bottom-center portal, 4 arrow buttons + inert center dot, hold-to-repeat.
- **Edit**: `src/components/smartboard/PresentationView.tsx`
  - Tighten Solution-open anchor to `headingRow + 1`.
  - Add `nudgeCursor` L/R branches; keep U/D using `findNextWritableEmptyRow`.
  - Add `completedLessonLines` state + lock/unlock on sensor row change and on floating-line change.
  - Add `isSensorAllowed(row, x)` unifying all restriction checks; use it from D-pad, click gate, and auto-advance.
  - Compute Floating Number panel row-footprint + ±1 row buffer, feed into `isSensorAllowed`.
  - Force floating panel to line 1 whenever it opens or the beat changes.
  - Mount `<SensorDPad />` when `panelOpen`.
- **Edit**: `src/components/smartboard/CursorScrollbar.tsx` — hide/remove usage in the left rail (kept as a component for now in case we want a keyboard-driven fallback, but no longer rendered in the presentation).
- **Tests**: extend `src/test/floatingSmartboardSync.test.ts` with cases for
  - "Solution just opened → sensor is exactly heading+1",
  - "D-pad Right/Left honors row ink boundary and left margin",
  - "Completed row rejects sensor until its floating line is reactivated",
  - "Floating panel opens at line 1 regardless of persisted state".

No backend changes. No schema changes. Pure Smartboard presentation-layer work.
