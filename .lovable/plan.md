## Problem

After the previous edit, the user reports the dashed placeholder cube next to filled content still renders. My fix only changed `isNodeFilled` so that `box` nodes count as unfilled — but the cube the user is pointing at may not actually be a `box` node. Likely candidates for the persistent cube:

1. A **structural node** (`power`, `frac`, `sqrt`, `sub`/`sup`, `bracket`) that was auto-inserted with empty rows. Its `RowView` for the empty sub-row renders the dashed cube (lines 79–124 of `MathTreeRender.tsx`). Those cubes are *expected* inside their own slot, but if such a node sits as an empty sibling in a row that already has content, the cube still shows.
2. A `box` node where my prior change should already work — needs live verification that the bundle reloaded.

## Plan

1. **Diagnose live.** Open the smartboard route in headless Chromium, take an element-level screenshot of the rendered math tree, and read the React tree via `data-erase-path` to identify the exact node kind of the lingering cube (box vs. power vs. frac slot, etc.).

2. **Extend the collapse rule in `RowView`.** Generalize `isNodeFilled` and `isEmptyBoxSibling` so that *any* structural node whose every sub-row is empty collapses to a zero-width tap zone when a sibling in the same row already has content:

   ```
   const isStructurallyEmpty = (n: Node): boolean => {
     if (n.kind === "char") return false;
     if (n.kind === "box")  return true;          // single empty slot
     const sub = (n as { rows?: Row[] }).rows;
     return !!sub && sub.every(r => r.length === 0);
   };
   ```

   Render rule: collapse `node` to the invisible tap-zone branch when `isStructurallyEmpty(node)` AND another sibling in the same row is non-empty.

3. **Keep slot-level cubes intact.** The dashed cube *inside* a structural slot (numerator, denominator, radicand, exponent) stays — that's the "tap here to write" hint, and it disappears the moment the teacher types into that slot (RowView's `empty` branch already handles this).

4. **Verify in the preview.** Re-run the same Playwright flow, type into each slot, and confirm cubes vanish per slot independently. Capture before/after screenshots.

## Technical notes

- Single file change: `src/components/smartboard/MathTreeRender.tsx`, `RowView` (around lines 127–192).
- No token/schema changes; pure render-time behavior.
- Cursor paths stay stable because the collapsed branch still occupies `node[i]` with a tap zone.
