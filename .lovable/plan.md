## What I verified

- `PresentationView.tsx:3444` (`buildLiveSnapshot`) converts every student row to a **flat ASCII string** (`rowToAscii`) before broadcasting. Only `rowsAscii` / `linesAscii` are sent — the actual math tree never leaves the board.
- `TeacherReasoningPanel.tsx:324` reads that string and hands it to `PresenterMath` → `renderMathInline`, which **re-parses the text back into a new structure**.
- The durable fallback path (`TeacherReasoningPanel.tsx:239`) does the same: it reads the real tree out of `state_json.freeLines` and immediately flattens it to ASCII.

So the Student Line is exactly what you diagnosed: a second mathematical object, rebuilt from text. An empty fraction on the board is `frac[ box[ ] , box[ ] ]`; ASCII turns it into `()/()`; the re-parser then makes a fraction whose numerator and denominator each contain a bracket pair — hence four placeholder cells instead of two, and hence a numerator cell that isn't the real one the student types into.

## Fix: broadcast the object, not a description of it

1. **Send the tree.** In `buildLiveSnapshot`, add `rowsTree: Record<number, Row>` and `linesTree: Record<string, Row>` alongside the existing ASCII fields (ASCII stays — the grader and diagnostics use it, and it remains the fallback for old clients). Rows are sent verbatim, no normalisation, no cloning through any parser.
2. **Render the tree.** In `TeacherReasoningPanel`, the Student Line uses the SmartBoard's own recursive renderer (`MathTreeRender`) in a read-only mode (inert cursor, no `onCursorChange` writes, board ink/placeholder colours), instead of `PresenterMath`. Only if `linesTree` is absent (legacy payload) does it fall back to the ASCII renderer.
3. **Fallback path mirrors too.** `loadFallback` keeps `state_json.freeLines[n]` as the raw row and stores it in `rowsTree`; ASCII is derived only for grading text, never for display.
4. **Expected Line stays as-is** — it is authored teacher text, not a live object, so it keeps rendering through `PresenterMath`.
5. **Read-only mode in `MathTreeRender`.** Add an optional `readOnly` flag that disables pointer/caret handlers and hides the caret, so the mirror can never mutate or steal focus.

## Placeholder duplication at the source

Even mirrored, an object like `frac[ box[ box[ ] ] , … ]` (nested empty boxes — I saw exactly this shape in the persisted student board state) renders as a cell inside a cell, which is why typing lands in the wrong one. I'll add a small normaliser applied where fraction/floating-chip structures are inserted on the board: a `box` whose only child is a single `box` collapses to one box. One writable cell per slot, on the board and therefore in the mirror.

## Debug aid

Add a tiny dev-only "object id" readout in the Reasoning panel: a stable structural hash of the rendered row (kind/arity path signature), shown next to the Student Line label, plus the same hash shown on the board in dev. Matching hashes prove one object; diverging hashes point at the copy.

## Files

- `src/components/smartboard/PresentationView.tsx` — extend snapshot payload with `rowsTree` / `linesTree`.
- `src/components/smartboard/TeacherReasoningPanel.tsx` — render Student Line via `MathTreeRender`; keep tree in fallback; hash readout.
- `src/components/smartboard/MathTreeRender.tsx` — `readOnly` prop.
- `src/lib/smartboard/mathTree.ts` (or a small helper) — nested-empty-box collapse + structural hash.
- `src/test/` — a test asserting an empty fraction mirrors as exactly two slots, and that the mirrored row's structural hash equals the board row's.
