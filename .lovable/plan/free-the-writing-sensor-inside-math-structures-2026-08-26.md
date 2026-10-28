# Free the writing sensor inside math structures

The sensor gets trapped inside a radical or fraction slot: once a row has ink you cannot walk the caret out with the on-screen D-pad, and ▲/▼ only jump whole board rows — they never step between a numerator and a denominator. That is why `√(y/6) + 8/8` could not be built: the only reachable slot stayed the denominator, and every typed character kept expanding the radical.

## What changes

1. **◀ / ▶ always walk the caret.** On a row that already has ink, the horizontal D-pad steps through the equation character by character and slot by slot (into and out of radicals, fractions, powers, brackets), exactly like the keyboard arrows already do. The buttons stop being greyed out on inked rows.

2. **▲ / ▼ become structure-aware.** When the caret sits inside a structure, ▲/▼ first move between that structure's slots — denominator → numerator, radical body → outside, exponent → base. Only when there is nowhere left to go vertically inside the structure do they fall back to today's behaviour of moving to the previous/next board row. Keyboard ArrowUp/ArrowDown follow the same rule.

3. **Escape to the outside.** Stepping right past the last slot of a structure, or pressing ▲ at the top slot, parks the caret immediately after the whole structure, so the next typed `+ 8/8` lands beside the radical instead of inside it.

4. **Click to place.** Clicking directly on any part of a written expression (numerator, denominator, under the root sign) places the caret there, so the sensor can also be repositioned without the D-pad.

5. **Visible caret feedback.** The caret renders in whichever slot it currently occupies, so the teacher always sees where the next character will go before typing.

Nothing about how ink is laid out, how rows are allocated, or how lesson-line locking works changes. Locked/prose rows stay unreachable.

## Technical notes

- `src/lib/smartboard/mathTree.ts`: add `moveUp`/`moveDown` (slot-to-slot within the nearest enclosing container, returning `null` when there is no vertical target) and an `exitContainerRight` helper. `moveLeft`/`moveRight` already exit containers correctly and stay as-is.
- `src/components/smartboard/PresentationView.tsx`:
  - `canCursorLeft` / `canCursorRight`: drop the `rowInk.length > 0 → false` guard; enable whenever the row is writable and not a notebook/prose row.
  - `nudgeCursorHoriz`: remove the `displayedLineRows` restriction for caret walking on the sensor's own row so it always delegates to `treeMoveLeft`/`treeMoveRight`.
  - `nudgeCursor` and the `ArrowUp`/`ArrowDown` keydown branches: try the new in-structure vertical move first; if it returns `null`, keep the existing row-nudge/band logic untouched.
- `src/components/smartboard/MathTreeRender.tsx` / `FreeWriteLayer.tsx`: verify click targets report the clicked slot path through `onCursorChange`; add per-slot hit areas where a slot currently has no clickable region.
- Tests in `src/lib/smartboard/__tests__/`: build `√(y/6) + 8/8` purely through cursor moves — enter the radical, fill numerator and denominator, exit right, type `+`, insert a second fraction — and assert the resulting tree has the fraction inside the radical and the `8/8` outside it.
