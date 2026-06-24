## Highlight Mode — Connectivity Rule + Selectable Structures

Two focused fixes, both confined to the Teacher Highlight Mode pipeline. AI Generation Mode is untouched.

### 1. Replace contiguity logic with a true connectivity rule

**File:** `src/lib/floating/highlightEngine.ts`

Current behaviour groups selected atoms into runs based on contiguity (a single unselected atom breaks the run into two chips). Replace this with the connectivity rule the teacher defined:

> Two selected atoms are connected **iff every atom strictly between them is also selected**.

Implementation:

1. Sort selected atoms by their equation index.
2. Walk the atom list from the first selected index to the last selected index.
3. If every atom in that span is selected → emit **one chip** containing all of them.
4. If any atom in the span is unselected → split at every unselected atom and emit one chip per maximal run of consecutive selected atoms.

This single rule replaces both the old contiguity logic and the special-case `allStructures` merge — it naturally handles every example in the spec:

| Equation | Selection | Result |
|---|---|---|
| `A + B` | `A`, `B` (no `+`) | `[A] [B]` |
| `A + B` | `A`, `+`, `B` | `[A+B]` |
| `Ax²+Bx+C` | `Ax²`, `Bx` (no middle `+`) | `[Ax²] [Bx]` |
| `Ax²+Bx+C=0` | everything | `[Ax²+Bx+C=0]` |
| `Ax²+Bx+C=0` | `Ax²`, `0` only | `[Ax²] [0]` |
| `A/B` fraction | `A`, bar, `B` | one fraction chip |
| `A/B` fraction | `A`, `B` (no bar) | `[A] [B]` |
| `(A+B)` | `(`, `)` only | `[(] [)]` (disconnected — `A+B` not selected) |
| `x²` | `x`, `²` | `[x²]` |
| `x²` | `²` only | `[²]` |

Note on brackets: the previous "all-structures merge" rule that produced a single `()` chip from just the open + close bracket is **removed**, because under the connectivity rule the unselected interior breaks the connection. This matches the teacher's clarification — no bridging, ever.

The existing residual-chip logic (atoms of an overlapped chip that the teacher did not re-select survive as their own chip) is preserved.

### 2. Make thin mathematical structures easy to click

**File:** `src/components/floating/EquationAtoms.tsx`

Keep all visible mathematics at its true size — no thicker bars, no handles. Add an **invisible enlarged hit area** around thin structures so clicks register naturally.

- **Fraction bar (`FracBar`)**: wrap the 1.5 px visible line in a transparent span that is ~12 px tall (≈6 px padding top + 6 px bottom) and full width. Click/hover events bind to the wrapper; the visible line remains exactly as drawn today.
- **Root sign / radicand overline**: extend the clickable region of the `√` glyph and the overline by ~6 px vertically using transparent padding.
- Apply the same wrapper pattern preventively to any future thin glyphs (we have just bar + root today; the helper will be reusable).

Visual output is pixel-identical for the teacher; only the pointer-event target grows.

### 3. Tests

**File:** `src/test/floatingHighlightEngine.test.ts`

Replace the old "structures merge non-contiguously" test (Ex: `(` + `)` → `()`) and add connectivity-rule cases:

- `A + B`, select `A` + `B` only → `[A] [B]`
- `Ax²+Bx+C`, select `Ax²` + `Bx` (no `+`) → `[Ax²] [Bx]`
- `Ax²+Bx+C=0`, select everything → `[Ax²+Bx+C=0]`
- `Ax²+Bx+C=0`, select `Ax²` + `0` → `[Ax²] [0]`
- Fraction `\frac{A}{B}` with bar selected → one chip; without bar → two chips
- `x²`, select `²` only → `[²]` (single attachment chip)
- `(A+B)`, select only `(` + `)` → two chips (regression for removed all-structures merge)

### Out of scope

- AI Generation Mode (`floating-assistant` edge function, Floating Number Laws) — untouched.
- Bidirectional highlighting (chip → equation, equation → chip) and chip swap — already implemented in the previous turn and confirmed working.
- Auto-expanding container structures — already handled by the recursive renderer.

### Technical summary

```ts
// highlightEngine.ts — new core
const selectedIdx = atoms
  .map((a, i) => (selected.has(a.id) ? i : -1))
  .filter((i) => i >= 0);
const first = selectedIdx[0], last = selectedIdx[selectedIdx.length - 1];
const allBetweenSelected = atoms
  .slice(first, last + 1)
  .every((a) => selected.has(a.id));

if (allBetweenSelected) {
  runs.push(atoms.slice(first, last + 1).map((a) => a.id));   // ONE chip
} else {
  // split at every unselected atom -> maximal selected runs
}
```
