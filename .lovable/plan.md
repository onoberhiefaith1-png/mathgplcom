# Mathematical tree navigation — the four `#` commands

## What already exists (verified)

The editor is already tree-based, not string-based. `src/lib/smartboard/mathTree.ts` defines real nodes (`char`, `subsup`, `frac`, `sqrt`, `bracket`, `matrix`, `bigop`, …), each container holding its own sub-rows, and a cursor of the form `{ path, index }` that addresses any depth. `MathInlineCanvas` edits that tree directly and renders it with the same engine AI Edit uses. So the structural foundation you describe is in place.

What is missing is exactly the part you identified: the command key only has **two** states.

- `#` — wrap the term on the left and open its superscript
- `##` — switch that fresh empty superscript to the subscript

There is no third or fourth state. When the caret sits at the deepest point of a nested power there is no "leave this branch and search back up the hierarchy" command, so the caret has to be walked out with arrow keys — and on a deep structure it feels trapped. That is the gap this upgrade closes.

Decisions taken: the command key stays `#` (so `R` remains an ordinary letter you can type), and the upgrade applies to both the Lesson Note editor and the Smartboard.

## The upgrade

### The four commands

| Input | Meaning |
| --- | --- |
| `#` | Enter / create the superscript branch of the term on the left |
| `##` | Enter / create the subscript branch |
| `###` | Leave the current branch and search **backward / upward** through the tree |
| `####` | Leave the current branch and search **forward / downward** through the tree |

Nothing is inserted into the note by any of them. They are navigation only, and never appear in the rendered mathematics.

### Nesting stays nesting

`1 # 2 # 3 # 4` continues to build a genuine chain — 2 is the superscript of 1, 3 the superscript of 2, 4 the superscript of 3 — not four independent scripts on 1. That is already the behaviour and it is preserved.

### `###` and `####` are tree searches

Both are implemented as searches over the node graph, never as "move N characters":

```text
###  →  current node
        ├── is there a valid position earlier in this row?      → go there
        ├── else step out to the parent container
        │     └── is there an earlier sibling branch (sup ← sub)? → enter it, at its end
        └── repeat upward until the root row is reached
              └── nothing valid → stay at the nearest valid position

####  →  the mirror image: later position in this row, then the next
         sibling branch (sub → sup), then downward into the parent's
         following content, ending at the row's end.
```

Rules that follow from your specification and are enforced:

- Missing branches are skipped, not entered — an absent subscript never produces a broken caret.
- Empty positions are skipped; the search continues to the next node that can actually hold a caret.
- Branches of unequal depth, and branches that start in the middle of an expression, are handled because the walk follows parent/child links, never a fixed rectangular grid.
- Multiple independent structures on one line are separate roots to the walk; `###` from inside one can land in the previous one.
- When no valid destination exists the caret does not move and no node is created.

Both commands work identically inside fractions, radicals, brackets, matrices, big operators and logarithm bases — the walk is defined on the node graph, so every container type is covered by construction.

### Clicking and editing stay as they are

A rendered expression remains editable mathematics: click anywhere to place the caret at that exact depth, edit or delete a value, add a script, arrow out of the object into the surrounding prose. That behaviour is already live and is not touched.

## What must not regress

The upgrade is strictly additive on top of the current working version:

- AI Edit's generation, preview and Apply path — unchanged.
- The math renderer (`renderMathInline`) and the normalisation pass — unchanged, so the recent spacing fix stands. `log₂ 2 + log₂ y + log₂ z` keeps its spacing and never re-fuses.
- Existing `#` and `##` behaviour — byte-for-byte the same, so nothing you have already typed changes meaning.
- Lesson-note content and schema — no migration, no rewrite.

## Verification before hand-back

Automated tree tests for: simple superscript; simple subscript; the `1 # 2 # 3 # 4` chain; nested subscripts; both branches on one base; `###` from the deepest position of a 4-level power; `###` then `####` round-tripping without the caret getting lost; a structure with a missing branch; two independent structures at different starting positions.

Then a live check in your note: build a nested power, press `###` from the deepest slot and confirm the caret steps out into the parent level, `####` walks back in, and nothing prints into the note. Finally generate a line with AI Edit, click into it, edit a value and add a script — all still editable.

## Technical notes

- `src/lib/smartboard/mathTree.ts` — new `navigateOut(root, cursor, dir)` engine plus the node-graph helpers it needs (parent of a cursor, ordered sibling branches of a container, previous/next caret-capable position). Pure functions, unit-testable without the DOM.
- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx` — the `#` handler grows from two states to four by counting consecutive command presses in the current caret session; the third and fourth call `navigateOut`. Existing wrap/switch logic untouched.
- `src/components/lessonnotes/extensions/MathKeyShortcuts.ts` — the prose-level `#` entry point stays as is (it only opens an object).
- Scope: the same canvas backs the Lesson Note inline and block math, the companion board and the Smartboard math surfaces, so one engine covers both. Any Smartboard typing surface not already on this canvas is pointed at the same engine rather than given its own copy.
- New test file for the tree navigation cases listed above.
- Not touched: `renderMathInline`, `normalizeMathSource`, AI Edit, exports, tables, diagrams, graphs.
