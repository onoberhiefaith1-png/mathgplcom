## What each category holds

**Core** — + − ± × ÷ · = ≠ < > ≤ ≥ ≈ ∞ √ ∛ % ° π, brackets ( ) [ ] { }, |x|, → ← ↔ ⇒ ⇔. Kept deliberately short, most-used first.

**Greek letters** — α β θ γ δ π λ μ σ φ ω Δ Σ Ω.

**Algebra** — x y z, a b c, n k, x² x³ xⁿ x⁻¹, √x ∛x, f(x), f⁻¹(x), then the openers x =, y =, f(x) =.

**Number & fraction** — ½ ⅓ ¼ ⅔ ¾, %, an empty fraction structure (type numerator, Tab, denominator), a/b, √, ∛.

**Plane trigonometry** — sin θ, cos θ, tan θ, sin⁻¹, cos⁻¹, tan⁻¹, θ α β °, SOH CAH TOA, and openers sin θ =, cos θ =, tan θ =.

**Geometry** — ∠ ⊥ ∥ △ ° 90° ≅ ∼, and labels AB BC CD AC, x y r d. Notation only; the Diagram tool is not duplicated.

**Coordinate geometry** — (x, y), (x₁, y₁), (x₂, y₂), Δx, Δy, m, c, x-axis, y-axis, y = mx + c, y = ax + b.

**Statistics & probability** — x̄ μ σ σ² n Σ, P(A), P(A∩B), P(A∪B), P(A|B), E(X), Var(X), SD, and openers P(A) =, P(A|B) =, E(X) =, Var(X) =.

**Calculus** — dy/dx, d²y/dx², d/dx, ∫, ∫ₐᵇ, lim, Δ, ∂, Σ, ∞, and lim x→a, dy/dx =, ∫ f(x) dx, ∫ₐᵇ f(x) dx.

**Sets** — ∈ ∉ ⊂ ⊆ ⊃ ⊇ ∪ ∩ ∅, then ℕ ℤ ℚ ℝ.

**Logarithms & exponentials** — log, ln, logₐ, eˣ, aˣ, 10ˣ, then logₐ(x), ln(x), eˣ, aˣ.

## Technical notes

- New data module `src/lib/lessonnotes/symbolQuick.ts`: the eleven categories in fixed order, each item declared as either a plain character (`insert text`) or a structure descriptor. Structures reuse the existing asset render kinds (`fraction`, `sqrt`, `power`, `sub`, `bigop`, `limit`, `paren`, `abs` …) so they insert through `insertAsset` and become real editable objects — the same route the Matrix palette now uses. Nothing generates raw LaTeX text into the document.
- Composite structures (`sin θ =`, `dy/dx =`, `∫ₐᵇ f(x) dx`) are declared as a short recipe: an optional literal prefix, then the structure the caret enters. This is the same `prefix + node` shape already used by `assetToMathInsertion`.
- Replace `src/components/lessonnotes/MathSymbolPanel.tsx` with a docked `<aside>` copying the Matrix panel's shell (`clamp(280px, 30%, 420px)`, close button, scroll container) plus a filter box.
- In `DocumentEditor.tsx`: add `symbolPanelOpen` state, make the Symbols ribbon button a toggle, and keep the three right-hand docks mutually exclusive (opening Symbols closes Matrix and Emoji, and vice-versa). Insert handlers reuse `insertSymbolText` for characters and a new `insertQuickSymbol` for structures.
- Matrix is excluded from the Symbols data by construction; the existing Matrix palette and the full Matrix builder are untouched.
- Unit tests for the data module: fixed category order, no matrix entry, every structure item resolves to an insertable node, and short codes/labels are unique.
