
# Editor Mode — Two-Rule Highlight Engine + Structural Chips

The current engine treats every atom the same and emits chips as flat strings. That's why a selected fraction-bar becomes `/`, a selected `(` and `)` become two separate `[(` `)]` chips, and structures lose their visual layout. The fix has three parts.

## What the editor does today (wrong)

- One rule (connectivity) applied to all atoms, structures included.
- Chip value = plain text concatenation of atom `value`s.
- Fraction-bar atom carries `value: "/"` → chip prints `/`.
- Brackets render as two separate glyphs; height never matches content.
- Renderer never knows a chip is "the fraction without its numerator."

## What it should do

### Rule 1 — Variables, numbers, operators (Connected / Disconnected)
Already implemented in `highlightEngine.ts`. Keep as-is. `x + 2`:
- click `x`, `+`, `2` → `[x+2]`
- click `x`, `2` (no `+`) → `[x] [2]`

### Rule 2 — Structures (reconstruct the mathematical object)
Structural atoms are: `fraction-bar`, `root-sign`, `bracket-open`, `bracket-close`, `exponent`, `subscript` (and later: integral, sum, abs, matrix).

When the teacher selects ANY structural atoms, the editor does NOT apply the connectivity rule to them. Instead:

1. Walk the original parsed `Node` tree for the equation.
2. Keep every structural node that owns at least one selected structural atom (the fraction node whose bar was selected, the sqrt node whose sign was selected, the bracket pair whose `(` OR `)` was selected — selecting either bracket implies the whole pair, because brackets are mathematically paired in the source equation).
3. Empty slots (numerator, denominator, radicand, bracket interior) start as `□` placeholders.
4. Selected NON-structural atoms (variables/numbers/operators) that originate from inside one of those kept structures drop into the matching slot in equation order. Same atoms outside any selected structure form their own variable chip per Rule 1.
5. The result is ONE chip per connected structural sub-tree, carrying the rebuilt sub-tree itself (not a string).

This is "reconstruct the mathematical object from the selected symbols, preserving the relationships inherent in the source equation" — no click-order, no equation-order precedence, no fixed ranking. The nesting is whatever the original equation already shows.

### Worked examples

Equation `A/(B+C)` (i.e. `\frac{A}{(B+C)}`), teacher clicks `bar`, `(`, `)`:

```
  □
─────
 (□)
```

Equation `√((A+B)/C)`, teacher clicks `√`, `bar`, `(`, `)`:

```
    ┌────────┐
   /   □
  √   ─────
   \  (□)
```

Equation `(x+2)`, teacher clicks `(` only → still emits the full pair `(□)` (brackets are inseparable in the source).

Equation `x + 2`, teacher clicks `x`, `+`, `2`, AND a fraction-bar from elsewhere on the line → two chips: `[x+2]` (Rule 1) and `[□/□]` (Rule 2).

## Implementation

### A. Chip data model (`src/lib/floating/highlightEngine.ts`)
Add a `structure?: Node[]` field to `Chip`. When present, the renderer draws the sub-tree instead of `value`. `value` stays as a serialisable fallback (LaTeX string built from the sub-tree, e.g. `\frac{}{(\;)}`) so existing persistence/`extractTermsFromAscii` paths keep working.

### B. Selection → chips (`applySelection` rewrite)
Split selected atoms into two buckets:
- `structuralIds`: atoms with kind ∈ {fraction-bar, root-sign, bracket-open, bracket-close, exponent, subscript}.
- `tokenIds`: everything else (number, variable, operator, equality, function-name, symbol).

1. Run the existing connectivity algorithm on `tokenIds` only → produces variable chips. Token atoms that fall inside a kept structural subtree are removed from this bucket first (they belong to the structural chip).
2. Build structural chips by walking the parsed `Node` tree (passed in from `EquationAtoms`):
   - `frac` node kept iff its `bar.id ∈ structuralIds`.
   - `sqrt` node kept iff its `sign.id ∈ structuralIds`.
   - `bracket-open`/`bracket-close`: pair them by walking the flat atom list with a depth counter so each `(` is matched to its `)`. A pair is kept iff either side is selected. Kept pairs become a synthetic `bracket` node with one slot.
   - Group kept structural nodes by maximal connected structural subtree in the source tree (a fraction whose denominator contains a kept bracket pair becomes ONE chip). Disconnected kept subtrees become separate chips.
   - Fill slots: selected non-structural atoms that lie inside the subtree's source range drop into the matching slot in equation order; empty slots stay as `□`.
3. Residual-chip logic (preserving the unselected half of overlapped existing chips) stays.
4. Order chips by first atom's equation index.

### C. Pass the tree into the engine (`EquationAtoms.tsx`)
`commit()` currently calls `applySelection(atoms, chips, selected)`. Extend the signature to `applySelection(tree, atoms, chips, selected)` so the engine has access to the source `Node[]` for structural reconstruction.

### D. Structural chip rendering
Add a small `<ChipMath>` component used by `FloatingWorkspace`'s `EditableChip`. When `chip.structure` is present, render the sub-tree using the same primitives as `EquationAtoms` (stacked fraction, real radical, raised exponent, lowered subscript) with `□` for empty slots. When absent, fall back to current `renderMathInline(displayLabel)`. This kills Bug 1 (`/`) and Bug 6 (sizing): the chip renderer is the same dynamic mathematical layout as the equation row, so fraction bars/root bars/brackets stretch to fit content automatically.

### E. Paired bracket rendering (Bug 4)
In `EquationAtoms.tsx`, parse matching `(` `[` pairs in `parseSequence` into a new `bracket` node (open, close, body) — same shape as `frac`/`sqrt`. Render with an `inline-flex` row whose left/right glyphs use `display:flex; align-items:stretch` and `transform: scaleY(...)` (or the standard CSS trick `font-size` tied to body height via `1em` line stretching), so the brackets visually surround whatever they wrap. This replaces today's "two separate floating glyphs" look. Also fixes selection: clicking either bracket selects the pair (a single `bracket` node owns both atom ids).

### F. Fraction-bar / root-sign click targets
Already enlarged in the previous turn — keep.

### G. Tests (`src/test/floatingHighlightEngine.test.ts`)
Add structural cases:
1. `\frac{A}{B}`: select bar only → 1 chip `□/□`.
2. `\frac{A}{(B+C)}`: select bar, `(`, `)` → 1 chip `□/(□)`.
3. `\sqrt{\frac{A}{B}}`: select √, bar → 1 chip `√(□/□)`.
4. `(x+2)`: select `(` only → 1 chip `(□)` (pair implied).
5. `\frac{A}{B} + x`: select bar, `x` → 2 chips: `[□/□]` and `[x]`.
6. `x + 2` with bar elsewhere: select `x`, `+`, `2`, bar → 2 chips: `[x+2]` (Rule 1) + `[□/□]` (Rule 2).
7. Mixed fill: `\frac{A}{B}`, select `A`, bar, `B` → 1 chip `A/B` (variables drop into slots).
8. Multi-selection no-limit: select 8 atoms across `Ax^2+Bx+C=0` → 1 connected chip when all atoms in the span are selected.
9. Fraction-bar alone never produces `/` as the chip text.

## Out of scope

- AI Generation Mode (unchanged; still applies Floating Number Laws).
- Bidirectional highlight / chip-swap (already shipped).
- Backend persistence schema — `chip.value` LaTeX fallback keeps existing storage compatible.

## Files

- `src/lib/floating/atoms.ts` — add `bracket` node (open/close/body) to the parser; brackets become a paired node like `frac`/`sqrt`.
- `src/lib/floating/highlightEngine.ts` — extend `Chip` with `structure`, rewrite `applySelection` to split by atom kind and reconstruct structural sub-trees from the source `Node` tree.
- `src/components/floating/EquationAtoms.tsx` — render the new `bracket` node with stretchy paired delimiters; pass `tree` into `applySelection`; expose a small `renderNodes` helper for chip reuse.
- `src/components/lessonnotes/FloatingWorkspace.tsx` — `EditableChip` uses new `ChipMath` when `chip.structure` is set.
- `src/test/floatingHighlightEngine.test.ts` — add the 9 cases above; keep existing connectivity tests.
