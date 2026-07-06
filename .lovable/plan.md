## Goal

Make every empty placeholder cube on the smartboard, in the Floating Number generator, and in the Preview panel render in the whiteboard colour `#efece5` so it blends invisibly on the board and is only faintly visible on lighter panels. Any old placeholder colour must be removed.

## What I found

The whiteboard surface is actually a soft gradient of `#f6f4ef → #eeece6 → #e8e6df` (see `BOARD_BG` in `src/pages/SmartboardPreviewPage.tsx`). `#efece5` sits inside that range, so a solid `#efece5` cube reads as invisible on the real board. The reason placeholders still look dark in the Floating Number generator / Preview panel is that there are **two** placeholder renderers, and only one was updated last turn:

1. `src/components/smartboard/MathTreeRender.tsx` — already uses `PLACEHOLDER_COLOR = "#efece5"` ✅
2. `src/components/smartboard/BoxLayer.tsx` — the line-anchored chip boxes (numerator/denominator/±/√ slots that ride on the writing line, visible in screenshot 2 next to "The quadratic formula is:") still use `1.5px dashed ${ink}`, where `ink` is the current pen colour (black on the whiteboard, black on the preview). This is the "black box" the user is describing.

The Floating Number generator's Preview also uses `BoxLayer` chips, which is why the box next to "±" and "√" reads as a darker outline in screenshot 1.

## Plan

**1. Introduce a single source of truth.**
Create `src/lib/smartboard/placeholderColor.ts`:

```ts
// Whiteboard surface colour. Every empty placeholder cube (math-tree
// sub-slot, BoxLayer chip, future placeholder renderers) draws its border
// and fill in this exact colour so it blends invisibly on the smartboard
// and stays faintly visible on lighter surfaces.
export const PLACEHOLDER_COLOR = "#efece5";
```

**2. `MathTreeRender.tsx`** — delete the local `const PLACEHOLDER_COLOR = "#efece5"` and import it from the new module. Behaviour unchanged. This is the "delete existing, rewrite with this function" step the user asked for.

**3. `BoxLayer.tsx`** — the "black box" the user is complaining about.
- Import `PLACEHOLDER_COLOR`.
- Change `borderStyle` for the empty chip from `` `1.5px dashed ${ink}` `` to `` `1.5px dashed ${PLACEHOLDER_COLOR}` ``.
- Once the teacher types into the chip (`filled === true`), keep today's behaviour (`1.5px solid transparent`), so the ink stays black and readable.
- Leave the division bar / drawn strokes / typed content colour untouched — those keep their current `ink` colour (per the user's "the division sign is black as it is").

**4. Nothing else changes.**
- No layout, tap-zone, cursor, or caret changes.
- Floating Number generator, Preview panel, and lesson-note pages all pick up the new colour automatically because they render through the same `MathTreeRender` + `BoxLayer` components.
- On the whiteboard the chip and math-tree cube both blend into the board (`#efece5` on a `#f6f4ef → #eeece6 → #e8e6df` gradient reads as invisible).
- On the Floating Number generator and Preview (white-ish panels), the chip and math-tree cube stay faintly visible as a cream outline — visible enough for the teacher to know where to type, but no longer "black".

## Files touched

- **new** `src/lib/smartboard/placeholderColor.ts`
- edit `src/components/smartboard/MathTreeRender.tsx` (replace local constant with import)
- edit `src/components/smartboard/BoxLayer.tsx` (swap `ink` for `PLACEHOLDER_COLOR` on the empty-chip dashed border only)

After this the user can generate any floating number (fraction, ±, √, matrix): every empty cube on the board is invisible, and the same cube is faintly cream on the generator / preview panels — as requested.
