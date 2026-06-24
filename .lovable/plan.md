# Floating Number Editor — Rendering Regression Fix

## The regression

The equation row in `FloatingWorkspace.tsx` now renders through `EquationAtoms`, which walks a flat character-level atom list and prints each atom as a `<span>`. That parser (`src/lib/floating/atoms.ts`) does not understand LaTeX structures — `\frac`, `\sqrt`, `^{...}`, `_{...}`, `\left/\right` — so they leak to the screen as raw source:

```
\frac{x+2}{x^2(x^2+4)}
```

Before the highlight-generation work the row went through `renderMathInline` (KaTeX), which produced proper stacked fractions, roots, exponents and brackets. The fix is to bring that visual renderer back without losing the per-atom click + Enter workflow.

## Goal

1. The equation always renders as proper mathematics (stacked fractions, real radicals, superscript exponents, subscript indices, real brackets). No LaTeX command, `^`, `_`, `\left`, `\right` is ever visible.
2. Each visible leaf (number, variable, operator, exponent, bracket, fraction numerator/denominator atom, radicand atom…) is independently clickable and has a stable id.
3. Clicking leaves + Enter still routes through `highlightEngine.applySelection` to create / merge / split chips. Connected selections collapse to one chip; disconnected selections produce multiple chips; selections that overlap existing chips replace them (correction rule).
4. One-to-one chip ↔ atom highlight: hovering a chip rings only its own atoms; clicking an `x` selects only that `x`, not every `x` in the equation.

## Implementation

### 1. `src/lib/floating/atoms.ts` — structured parser

Extend the parser so it produces a small tree of nodes, not a flat list, while still exposing a flat list of selectable leaf atoms with stable ids.

New node kinds:
- `frac { num: Node[]; den: Node[] }`
- `sqrt { radicand: Node[]; degree?: Node[] }`
- `sup  { base: Node[]; exp: Node[] }`  (from `^{...}` or unicode ⁿ run)
- `sub  { base: Node[]; idx: Node[] }`
- `bracket { shape: "(" | "[" | "{"; body: Node[] }`
- leaf `atom` (current `Atom` shape, kept for the engine)

Parser additions:
- Recognise `\frac{a}{b}`, `\sqrt{x}`, `\sqrt[n]{x}`, `^{...}`, `_{...}`, `\left(` / `\right)`, `\cdot`, `\times`, `\div`, `\pm`, common `\alpha … \omega`.
- Strip `\left` / `\right` and unknown spacing commands.
- Every leaf still gets `id = ${lineId}:a${counter}` so the engine and chip storage keep working unchanged.

Helpers:
- `flattenAtoms(tree): Atom[]` — used by `highlightEngine.applySelection` and `reconstructAtomIds`. The engine already operates on the flat list and that contract does not change.
- `nodesToText(tree): string` — only for hidden labels/toasts, never for display.

### 2. `src/components/floating/EquationAtoms.tsx` — visual renderer

Replace the current flat `atoms.map(...)` with a recursive renderer over the node tree:

- `frac` → flex column with numerator slot, a `1px` rule, denominator slot.
- `sqrt` → radical sign + top bar over the radicand slot; optional small degree top-left.
- `sup` / `sub` → base then a smaller, raised / lowered slot. Never print `^` or `_`.
- `bracket` → real `(` `[` `{` glyphs around the body.
- Leaf atom → same clickable span as today (selection state, hover ring, `onAtomHover`).

Selection / Enter behaviour is unchanged: clicks toggle `selected: Set<atomId>`, Enter calls `applySelection(flatAtoms, chips, selected)`. Because leaf ids are still globally unique per equation, the one-to-one chip↔atom highlight already works.

### 3. `src/components/lessonnotes/FloatingWorkspace.tsx`

- Keep `EquationAtoms` as the equation row (no KaTeX fallback needed once the parser handles structures).
- `reconstructAtomIds` keeps working on the flat atom list, so legacy chips persisted as strings still bind to atoms.
- Remove the now-unused `renderMathInline` import from this file if it's no longer referenced.

### 4. Tests

Extend `src/test/floatingHighlightEngine.test.ts` with cases that feed equations containing `\frac`, `\sqrt`, `^{...}` and assert:
- No raw `\`, `^`, `_` token reaches the rendered text (snapshot of leaf atom values).
- Selecting `A`, `x`, `²` in `Ax^{2}+Bx+C` and pressing Enter produces a single `[Ax²]` chip.
- Selecting `A`, `x`, `²` and `C` produces two chips `[Ax²]`, `[C]`.
- Selecting the numerator atoms of `\frac{x+2}{x^2(x^2+4)}` produces a chip whose value is `x+2`, leaving the denominator untouched.

### 5. Out of scope

- AI prompt / `floating-assistant` edge function — already pivoted to atom-id selections.
- Chip row UI, undo/redo, persistence — untouched.

## What the teacher will see after the fix

- `\frac{x+2}{x^2(x^2+4)}` renders as a real stacked fraction with `x²(x²+4)` in the denominator.
- Clicking `x` in the numerator highlights only that `x`; pressing Enter produces `[x]` and leaves every other `x` in the equation alone.
- No `\frac`, `\sqrt`, `^`, `_`, `\left`, `\right` ever appears on screen.
