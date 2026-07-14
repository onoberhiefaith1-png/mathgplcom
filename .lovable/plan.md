
## 1. Long Division — sensor direction (left → right)

**File:** `src/components/lessonnotes/extensions/visuals/arithmetic/LongDivision.tsx` (+ helpers in `src/lib/division.ts` if needed)

- Cursor / sensor entry point is the **leftmost writable cell** of the current row, and advances **rightwards** (col index increasing). Never right-to-left.
- Arrow keys / auto-advance move `col + 1`, wrapping to next row's leftmost cell.
- **Space bar** = "skip / push forward one column" (advance one cell without writing). Currently the sensor jumps to the highest place value; that anchor is removed — the teacher can begin at any column (e.g. tens) by pressing Space to move rightwards from the far-left position.
- Backspace moves one column left (opposite direction only for correction).
- Fix `buildSteps` traversal so `targetCol` order is ascending within each row.

## 2. Lock table structure — no split on double-click

**Problem:** Double-clicking a cell in SmartTable / PlaceValueChart / LongDivision / DivisionLadder / BaseConversion / FractionWall causes the underlying ProseMirror node to fragment (e.g. `98` becomes detached).

**Fix (applies to every arithmetic + smart table asset):**
- In the `MathVisual` NodeView wrapper (`src/components/lessonnotes/extensions/MathVisual.tsx`) and each asset's `SelectionFrame`:
  - Add `atom: true` semantics — the visual is treated as a single indivisible node.
  - Intercept `dblclick` on the asset container: `e.preventDefault()` + `e.stopPropagation()`, then route to "enter edit mode" (open right-hand Properties Panel) instead of letting ProseMirror descend into the DOM.
  - Add `contentEditable={false}` on all internal table wrappers so ProseMirror never merges/splits them.
- Cells that ARE editable (digit inputs) keep their own `contentEditable` / `<input>` — only the *structural chrome* is locked.

## 3. Auto-show / auto-hide bottom toolbar (Add/Remove Row/Column)

**File:** `src/components/lessonnotes/panel/AssetBottomToolbar.tsx` + host wrappers.

Current behavior: requires multiple clicks; disappears on first interaction.

New behavior (applied to **every** tabular asset — SmartTable, PlaceValueChart, LongDivision, DivisionLadder, BaseConversion, FractionWall, FractionStrip):

- Toolbar becomes visible whenever the **pointer/sensor enters the asset's bounding box** (or asset is selected) — no click required.
- Toolbar **stays visible** while the pointer is over the asset OR the toolbar itself, OR any of its buttons was used in the last 10 s.
- **10-second idle auto-hide timer:** resets on any pointer move / button click within the asset. When idle > 10 s AND pointer is not over the asset, fade out.
- Removes the current "hide on any click" behavior.

Implementation:
- New hook `useHoverIdleVisibility({ idleMs: 10000 })` returning `{ visible, bind }` — attaches `onPointerEnter`, `onPointerMove`, `onPointerLeave` handlers and manages a timeout ref.
- `AssetBottomToolbar` consumes this hook; wrapper attaches `bind` to both the asset container and the toolbar so moving between them counts as one hover region.

## 4. Files touched

- `src/components/lessonnotes/extensions/visuals/arithmetic/LongDivision.tsx` — cursor direction, Space-to-skip
- `src/lib/division.ts` — step order (left→right target cols)
- `src/components/lessonnotes/extensions/MathVisual.tsx` — atomic node, dblclick guard
- `src/components/lessonnotes/extensions/visuals/living/SelectionFrame.tsx` — contentEditable=false on chrome
- `src/components/lessonnotes/panel/AssetBottomToolbar.tsx` — hover + 10s idle visibility
- `src/hooks/useHoverIdleVisibility.ts` (new)
- Each arithmetic asset (`PlaceValueChart`, `LongDivision`, `DivisionLadder`, `BaseConversion`, `FractionWall`, `FractionStrip`, `Base10Blocks`) + `SmartTable` — wrap with the shared hover region and pass `bind` to their `AssetBottomToolbar`.

## 5. Also fixes

- The `BaseConversion` "Maximum update depth exceeded" console error (setState-in-effect loop) — will refactor its init effect to run once, not on every parent render.

## Out of scope

- No changes to Properties Panel layout, styling, or existing right-hand editing surface (already correct per universal editing rule).
- No changes to data schemas or backend.
