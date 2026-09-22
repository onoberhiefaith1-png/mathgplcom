# Structured Mathematics on Game Writing Surfaces

## Goal

Make every Game Writing Surface render the existing Floating Numbers mathematics tree as genuine mathematical layout—fractions, scripts, roots, matrices, large operators, limits, brackets, absolute values, binomials, and nested combinations—without changing Smartboard behavior or the established marking, Vault, rewards, and assignment logic.

## Confirmed current state

- The shared mathematics model is already a nested tree with first-class nodes for fractions, roots, powers, superscripts, subscripts, brackets, large operators, matrices, accents, binomials, and placeholders.
- Smartboard already renders that tree structurally and stores the tree itself for reload.
- The mathematical structure is lost only at the Game boundary: the Game currently converts each tree into a flat display string, then sends that string through its Surface Test and 3D Test text renderers.
- Game grading and Vault matching intentionally consume a separate clean text representation. That pathway must remain unchanged.
- Piecewise/cases exists in lesson-note structures, but it is not currently a node in the shared Smartboard mathematics tree. It therefore requires a deliberate tree-model extension rather than a rendering-only fix.

## Implementation

### 1. Add a structure-preserving Game channel

- Keep the existing clean-text callback exactly as the authority for marking, equivalence, Vault matching, reporting, and evaluation.
- Add a parallel Game-only callback that emits cloned `Row` trees grouped by Game Line, plus the active structural cursor.
- Preserve empty sub-rows as structural placeholders instead of inserting display glyphs into a string.
- Carry the structured row through Game Play into each matching physical writing surface without replacing the saved teacher text or question text.

### 2. Build the Game writing-surface math renderer

- Create a dedicated Game renderer that consumes the shared mathematics tree but has its own physical-surface presentation.
- Recursively lay out every supported node:
  - true stacked fractions and binomials;
  - attached superscripts, subscripts, and combined scripts;
  - connected radicals, including indexed roots;
  - grouped brackets, parentheses, absolute values, norms, floors, and ceilings;
  - 2×2, 3×3, and general matrices with independent cells;
  - integrals, contour integrals, sums, products, coproducts, and limits with correctly positioned bounds;
  - accents, boxes, geometry labels, and arbitrary nested combinations.
- Render every empty child row as a visible placeholder owned by its parent structure.
- Render the live sensor from its tree path and index, never by inserting a `|` character into the mathematics.
- Use the physical Game surface’s ink, placeholder, material, text-size, and visibility rules while keeping the structure coherent as one measured object.

### 3. Fit structured layout inside each physical surface

- Measure the complete rendered structure, including fraction depth, matrix height, limits, nested scripts, and radicals.
- Feed those bounds into the existing 5%–95% writing-band containment and content-driven surface growth rules.
- Scale or wrap only at valid top-level boundaries; never split a fraction, script pair, matrix, radical, or operator bounds across surfaces.
- Keep question Surface 0 read-only and map solution trees deterministically to Surface/Line 1 onward in Edit, teacher play, student play, preview, and reload.
- Keep the inactive legacy renderer mounted but invisible until structured-render parity is proven, preserving the existing renderer-switch contract.

### 4. Complete structural sensor navigation

- Keep left/right movement on the existing shared tree cursor.
- Expand Game-only up/down destination rules to cover all valid structures already represented by the tree:
  - numerator ↔ denominator;
  - baseline ↔ exponent/subscript;
  - radical content and optional index;
  - matrix rows while preserving the current column;
  - upper/body/lower regions of integrals, sums, products, and limits;
  - stacked binomial rows and nested structures.
- Enable each direction only when that exact destination exists; controls never create structures, change Game Lines, or invent empty destinations.
- Preserve horizontal movement inside the current child row and deterministic exit back to the parent baseline.

### 5. Add piecewise/cases support safely

- Extend the shared tree with a first-class piecewise node containing ordered expression/condition rows.
- Add parsing, rendering, placeholder, cursor-navigation, serialization, and reload support for that node.
- Keep this model extension backward-compatible and do not alter existing Smartboard layout or controls for current node types.

### 6. Preserve all non-display contracts

- Do not change clean mathematical text sent to marking, predictive equivalence, Vault exact-sequence matching, inspector, or rewards.
- Do not change Floating Numbers manipulation, line ownership, assignment progression, Game persistence scope, Slate Artisan, rooms, camera, sounds, or reward activation.
- Keep the Smartboard interface unchanged; share only its mathematics model and cursor semantics.

## Verification

- Unit-test tree emission, structural cloning, placeholders, cursor paths, up/down availability, parent exits, and save/reload stability.
- Add renderer tests for: `x² + 3x + 2`, `x₁ + x₂`, `3x/5`, `√(x + 3)`, `2(x + 3)`, 2×2 and 3×3 matrices, `∫₀¹ x² dx`, summation from `s = 5` to infinity, `lim(x→0) (sin x)/x`, absolute value, fraction-with-power, power-with-fraction, nested brackets, piecewise expressions, and mixed nested structures.
- For every case verify true layout, attached placeholders, valid four-direction sensor movement, intact structure after Floating Numbers manipulation, and unchanged structure after reload.
- Add regression tests proving grading and Vault results are byte-for-byte unchanged when the structured display channel is present.
- Verify live Game rendering on desktop and phone in Surface Test and 3D Test, including containment, scrolling, renderer switching, and no console/runtime errors.

## Technical approach

The source of truth remains the existing `Row`/`Node` mathematics tree. The Game receives two synchronized projections:

```text
Shared mathematics tree
├── clean text projection → marking, Vault, evaluation (unchanged)
└── structured projection + cursor → physical Game writing renderer
```

The new renderer is Game-specific, but node meaning, placeholder ownership, cursor paths, and movement semantics remain shared. No genuine structure is reparsed from text, and no genuine structure is flattened for display.
