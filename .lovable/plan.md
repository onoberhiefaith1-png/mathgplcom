## Goal

Replace the current "Unicode superscript/subscript character" implementation of `#` / `##` with a true recursive **nested math container** model, where every superscript and subscript is itself a full editable math workspace and the cursor navigates a tree.

## Why the current system can't do this

`MathKeyShortcuts.ts` today converts `#X` → one Unicode glyph (e.g. `x²`). It operates on flat text and cannot represent `x^{2^{5^n}}` or `x^{2_{n^{3_k}}}`. Nesting is fundamentally impossible in that model.

We already have the right data structure elsewhere: `src/lib/smartboard/mathTree.ts` defines `Row`, `Node`, `Cursor` with `sup`, `sub`, `power`, `subsup` containers, plus `insertNode`, `moveLeft/Right`, `backspace`, and `exitCompletedScriptCursor`. This is exactly the recursive tree the user is describing. The plan is to make lesson-note math use that tree.

## Editing model

- Math lives inside the existing `mathInline` TipTap node (`MathInline.tsx`). We upgrade its storage from a LaTeX string to a `Row` tree (with a LaTeX projection kept for rendering, export, and back-compat).
- Inside a `mathInline` node the cursor is a `Cursor` into the tree, not a ProseMirror position. All `#` / `##` / typing / space / arrows / backspace apply to the tree cursor while focus is inside math.
- Outside math (regular prose), the editor behaves as today.

## Activation rules (per user spec)

Let "parent object" = the node immediately to the left of the tree cursor in the current row (a char, a bracket, a frac, a previously-created sup/sub, etc.).

1. **In prose, bare `#` / `##` with no parent → literal `#` character.** No math node is created.
2. **In prose, `X#`** (parent exists in the current run) → convert `X` (or the last mathematical term to the left, using existing `extractWrapTargetLeftOf` semantics) into a `mathInline` node containing `[X, sup([])]`, move cursor into the empty `sup` slot.
3. **Inside math, `#` with a parent object to the left** → wrap that object in a `power` (`base^{□}`) via `insertNodeWrapping`, cursor lands in the empty exponent slot. If the exponent slot is currently empty (no parent), `#` is ignored.
4. **`##` mirrors rule 3 but for subscript.** If a `sup` already sits to the left with content, `##` inside that sup attaches a `sub` to its content (producing `subsup` / nested `sub` as appropriate).
5. **`##` typed inside an already-armed `#` slot with content** → converts current `sup` into `subsup` (adds sub sibling).
6. **Empty container + `#` or `##` → ignored** (no "superscript of nothing").
7. **Literal `#`**: two consecutive `#`s with no valid parent, or `\#` escape, insert the character.

## Cursor navigation

- **`#` / `##`**: create-and-descend as above.
- **Space inside math**: `moveRight` up one level — pop out to the parent row (uses existing `exitCompletedScriptCursor` generalised to any container). No visible space is inserted. Successive spaces climb further; once the cursor exits the outermost `mathInline` back into prose, the next Space inserts a real space.
- **Left/Right arrows**: use existing `moveLeft` / `moveRight`, which already hop into and out of sub-rows.
- **Backspace**: existing `backspace()` — deletes previous node; if at start of an empty container, removes the container.

## Rendering

- The math node view renders the tree using existing components (`renderMathInline` currently takes LaTeX). We add a `renderRow(row: Row): ReactNode` renderer that produces the same visual output for `char/sup/sub/power/subsup/frac/sqrt/bracket` — most of this exists in the smartboard renderer and can be reused.
- For export / AI / persistence we serialise the tree to LaTeX via a new `rowToLatex(row)` and continue to store `data-value` for parseHTML compat. Legacy nodes with only `data-value` are parsed once through `friendlyToLatex` + a small LaTeX→tree parser (supports `x^{…}`, `x_{…}`, `\frac`, `\sqrt`) so existing notes keep working.

## Files to change

- `src/components/lessonnotes/extensions/MathInline.tsx` — swap atomic node view for the tree-based editor; keep `value` (LaTeX) as a derived attribute for HTML serialisation and legacy parse.
- `src/components/lessonnotes/extensions/MathKeyShortcuts.ts` — remove Unicode `SUPER` / `SUB` maps and the `#`/`##`→glyph flow. Keep bracket pairing and `/`-fraction. Add a small handler that, when `#` is typed in prose with a valid parent term, replaces that term with a new `mathInline` node containing `[term, sup([])]` and focuses into it. All further `#` / `##` / Space handling happens inside the node view.
- `src/lib/smartboard/mathTree.ts` — reuse as-is; add `rowToLatex(row)` and `latexToRow(latex)` helpers (new small file `src/lib/smartboard/mathTreeLatex.ts`) so lesson notes can round-trip.
- (Optional, for parity) expose the same tree-cursor keymap the smartboard uses so the two surfaces stay in lockstep.

## Out of scope

- Redesigning the smartboard editor itself (it already uses this tree).
- Changing `@` Quick Insert, `/` fractions, matrix shortcuts, bracket pairing — those remain exactly as today.
- Visual styling of superscript/subscript beyond what the existing math renderer already produces.

## Acceptance checks

1. Typing `x#2#5##n#3##k` produces `x^{2^{5_{n^{3_k}}}}` with the cursor at the innermost empty slot at each step, and no Unicode glyphs.
2. Pressing `#` at the very start of a line (no parent) inserts a literal `#`.
3. Pressing `#` twice inside an empty superscript is ignored (no runaway nesting).
4. Pressing Space inside `x^{2^{5}}` moves the cursor: inner sup → outer sup → base row → prose, one level per press; only the fourth Space inserts a real space.
5. Existing lesson notes containing `mathInline` nodes with LaTeX like `x^{2}`, `H_{2}`, `\frac{a}{b}` open unchanged (legacy parse path).
6. Export to DOCX / AI JSON continues to emit the same LaTeX strings.