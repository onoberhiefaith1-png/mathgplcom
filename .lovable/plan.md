# Lesson-Aware Cursor + Working Area

Goal: stop treating the sensor like a word-processor caret. Bind it to **Lesson Lines** inside the active Solution's **Working Area**, auto-advance per Enter, lock all presentation content, and decouple the expandable panels so the canvas never reflows.

## 1. Model: Lesson Line vs Physical Row

Add a logical layer on top of the existing physical row grid.

- A **Physical Row** stays exactly what it is today: one slot on `grid.lineToY`.
- A **Lesson Line** is one teaching step (intro sentence, equation, fraction, matrix, …). It may span 1..N physical rows but is the unit the cursor, floating-number strip, and notes attach to.
- Each Lesson Line carries:
  - `id`
  - `kind`: `"prose-locked" | "heading-locked" | "question-locked" | "writable"`
  - `beatId` (which Solution/Example beat it belongs to)
  - `rowSpan`: rows it currently occupies (recomputed from rendered height / structural content)
  - `floatingGroupId` (one strip per Lesson Line, not per row)

A `LessonLineMap` per beat will be derived in `src/lib/smartboard/presentation.ts` alongside the existing notebook attachment pass, exposing:
- `lessonLinesForBeat(beatId)`
- `lineAt(row)` → Lesson Line containing that physical row
- `nextWritableLine(currentId)` / `prevWritableLine(currentId)`

## 2. Working Area per Solution

For every beat whose kind is `solution` (or `working`):

- `workingArea.topRow` = first physical row *after* the locked "Solution" header line.
- `workingArea.bottomRow` = last physical row *before* the next beat header.
- Only `writable` Lesson Lines inside this range accept the sensor.

`clampToActiveBand` in `PresentationView.tsx` is replaced by `clampToWorkingArea(beat, candidateRow)` which:
1. Maps `candidateRow` → containing Lesson Line via `lineAt`.
2. If that line is locked or outside `[topRow, bottomRow]`, snap to the nearest writable Lesson Line inside the area (preferring the current one).
3. Returns `{ line, rowOffsetInside }` so multi-row Lesson Lines (e.g. tall fractions) can place the caret on the correct internal row without leaving the Lesson Line.

## 3. Cursor as Lesson-Line cursor

Replace the current `sensor: { line, x }` state with:

```ts
type LessonCursor = {
  beatId: string;
  lineId: string;        // logical Lesson Line
  rowOffset: number;     // physical row within the Lesson Line (for tall structures)
  caret: Cursor;         // existing tree caret inside that row
};
```

All call-sites that today write `setSensor({ line, x })` or `setLiveCursor(...)` go through new helpers:
- `placeCursorAtFirstWritable(beatId)` — used on beat enter, page restore, and after a Lesson Line is committed.
- `advanceLessonLine()` — Enter handler; commits current line, allocates the next writable Lesson Line (creates a new one at the bottom of the working area if needed), and snaps the sensor to it.
- `moveLessonLine(dir: "up" | "down")` — Arrow Up/Down jumps **Lesson Lines**, not physical rows.

Clicks (`FreeWriteLayer.onCursorChange`, the canvas `onPointerDown` fallback near line 2227 and 2317): resolve the click to a Lesson Line via `lineAt`; if it's locked or outside the Working Area, **ignore** the click — do not move the cursor.

## 4. Auto-placement & Auto-advance

- On beat activation / route mount: call `placeCursorAtFirstWritable(activeBeatId)`.
- On Enter (already wired around line 2747): replace `clampToActiveBand(nextLine)` with `advanceLessonLine()`.
- On structural insert that grows the active Lesson Line (fraction, sqrt, matrix), `rowSpan` is recomputed and the working area `bottomRow` shifts; subsequent Lesson Lines reflow via the existing `lineToY` pipeline plus the new `LessonLineMap`.

## 5. Floating Numbers follow the Lesson Line

`FloatingNumberPanel.tsx` currently keys off the active physical line. Change its input from `activeRow` to `activeLessonLineId` (passed down from PresentationView). The strip's vertical clamp uses `workingArea.topRow` / `workingArea.bottomRow` of the active beat — never above Solution, never into the next beat.

## 6. Locked Presentation Areas

Lesson Lines with kind `prose-locked | heading-locked | question-locked` reject:
- pointer caret placement (FreeWriteLayer click gate)
- arrow navigation lands (skipped by `nextWritableLine` / `prevWritableLine`)
- programmatic `setLiveCursor` (helper rejects, falls back to current writable line)

This subsumes the existing "notebook-prose exclusion" — it becomes a single locked-line rule.

## 7. Smart Recovery

Persist `{ beatId, lineId, rowOffset, caret }` to `localStorage` under `smartboard:lessonCursor:<notebookId>` on every commit. On mount, if a stored cursor's `lineId` still resolves in the rebuilt `LessonLineMap`, restore it; otherwise call `placeCursorAtFirstWritable` for the same beat. Floating-number active line is derived from the restored `lineId`.

## 8. Independent Expandable Panels (no layout shift)

Today the top toolbar and bottom Writing Lab share flex space with the canvas, so opening one resizes the other.

- Move both panels to `position: absolute` overlays *above* the canvas, with their own backdrop:
  - Top toolbar: `top: 0`, slides down, `pointer-events: auto` on the panel, transparent gutter underneath.
  - Bottom Writing Lab: `bottom: 0`, slides up.
- The canvas keeps a fixed inner height (`100vh - chromeReservedPx`). `chromeReservedPx` is a constant baseline (collapsed heights of both bars), never recomputed when a panel expands.
- Each panel owns its own `expanded` state; neither reads the other.
- Add a small "safe-area" CSS variable so the floating-number strip and sensor never render under an expanded panel (only their *visibility* is affected; the canvas layout itself stays put).

## 9. Files to change

- `src/lib/smartboard/presentation.ts` — emit `LessonLineMap` per beat (writable vs locked, rowSpan, working area bounds).
- `src/lib/smartboard/grid.ts` — small helper `rowToLessonOffset` if needed; no spacing-formula changes.
- `src/components/smartboard/PresentationView.tsx` — replace `sensor`/`clampToActiveBand` with `LessonCursor` + helpers; rewire Enter / Arrow / click / restore paths; pass `activeLessonLineId` down.
- `src/components/smartboard/FreeWriteLayer.tsx` — click gate consults `lineAt(row).kind`.
- `src/components/smartboard/FloatingNumberPanel.tsx` — key off `activeLessonLineId`; clamp vertical movement to working area.
- `src/components/smartboard/SettingsSheet.tsx` and the top toolbar / bottom Writing Lab containers — move to absolute overlays with independent expand state; introduce `chromeReservedPx`.
- New: `src/lib/smartboard/lessonLines.ts` — pure helpers (`buildLessonLineMap`, `nextWritable`, `prevWritable`, `lineAt`).
- New tests in `src/test/`:
  - `lessonLineMap.test.ts` — locked vs writable classification, rowSpan from tall structures, working-area bounds.
  - `lessonCursor.test.ts` — Enter advances Lesson Line, clicks on locked content are ignored, restore picks up the same Lesson Line.

## 10. Out of scope

- No changes to math rendering, line spacing slider, or text-size slider.
- No changes to AI editor / floating-number generation logic — only *which* Lesson Line the strip is bound to.
- No DB schema changes; recovery uses `localStorage` like the existing `lineSpacingV2` key.

## Acceptance checks

1. Clicking the question, headings, or "Example 2" leaves the sensor inside the current Working Area.
2. Pressing Enter after `2x²+5x+6=0` moves the sensor to a new Lesson Line, not the next physical row inside a tall fraction.
3. A multi-row fraction is treated as one Lesson Line; one floating-number strip; one optional note.
4. Reloading the page restores the same Lesson Line and caret position.
5. Expanding the bottom Writing Lab does not move or resize the canvas; expanding the top toolbar does not hide the Writing Lab.
