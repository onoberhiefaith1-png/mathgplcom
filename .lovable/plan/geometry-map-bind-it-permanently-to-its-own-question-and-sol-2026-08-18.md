# Geometry Map — bind it permanently to its own question and solution

The map feature works; the wiring that tells it *which* solution to read does not. Verified causes in the current code:

- `questionContextForPos` (`src/lib/geometry/map/solutionText.ts`) walks only the note's **top-level** children and only treats headings of level ≤ 2 as structural. Solution headings are inserted at **level 3** (`solutionPlaceholderNodes` in `DocumentEditor.tsx`), and solution bodies often live inside `solutionMath` / `solutionProse` / `canvasFrame` nodes. So the collected `solution` string is frequently empty — "Generate Map from Solution" then has nothing to map.
- The page-layer diagram passes the question at the **caret position**, not the diagram's own owner question (`DocumentEditor.tsx` ~3167). Scrolling/clicking elsewhere silently swaps which question's solution is used.
- The scene stores no `questionId` / `solutionId`; `readMap`/`writeMap` keep only items, so there is no way to tell whether a stored map still belongs to the current solution, and nothing marks a map stale after a solution edit.

## What changes

### 1. Permanent Question → Diagram → Solution → Map binding
- Every diagram resolves its owner question through the existing `ensureOwnerQuestionId` / `ownerQuestionIdFor` (question `sectionId`) — no new database tables; the note is the store, so the binding travels with class copies, slides and Smartboard.
- `geometryMap` on `scene.meta` gains: `questionId`, `solutionHash`, `generatedAt`, `status` (`none` | `ready` | `stale`).
- The map panel always resolves its solution from **its own diagram's owner question**, never from the caret. Ten diagrams on one page therefore each read their own solution.

### 2. Correct solution extraction
Rewrite `solutionText.ts` to resolve the owner question heading, then collect that question's section content **through frames** (`canvasFrame`, `solutionMath`, `solutionProse`) using `sectionEndWithin` / `containerRangeFor` and `diagramsOwnedByQuestion`-style ownership, recognising Solution headings at any level (level 3 included). Returns `{ questionId, question, solution, solutionHash, hasSolution }` and stops at the next question so nothing bleeds across questions.

### 3. Solution status drives the button
Map panel header shows context:

```text
GEOMETRY MAP — Example 3
Based on the saved solution for this question      [diagram thumbnail]
Solution: Saved ✓        Map: Ready / Out of date / Not generated
```

- No solution → an explanatory state ("This question has no saved solution yet") plus **Open Solution**, which closes the map workspace and puts the caret in that question's Solution block. Returning re-enables generation automatically.
- Pre-flight checks on Generate name exactly what is missing (no question / no diagram / no solution / no identifiable steps) instead of failing silently.

### 4. Generate right after the solution is written
When AI generation (or a manual save) finishes a Solution block for a question that owns a diagram, offer inline:

```text
Solution saved.  Generate Geometry Map from this solution?   [Generate Map] [Do Later]
```

Generate runs the existing `generateGeometryMap` server function on that question's solution and writes the map onto that diagram's scene with the new binding fields.

### 5. Staleness
On opening the map (and after a solution edit), recompute `solutionHash`. If it differs from the stored one, the map is marked **OUT OF DATE** with a **Regenerate Map** action; old items stay visible but flagged. Nothing silently keeps a mismatched map.

### 6. Unchanged / already in place
Order follows solution steps; one principle per item; no measured values (`stripNumericAnswers`); `objectIds` validated against real scene ids and glow on click; teacher can add / edit / reorder / remove / relink / publish; Specific/General stays retired; the student view remains a read-only ordered map with click-to-glow.

## Technical notes

- Edited: `src/lib/geometry/map/solutionText.ts` (frame-aware extraction, any-level Solution headings, hash + questionId), `src/lib/geometry/map/model.ts` (binding fields, `status`, staleness helper), `src/components/lessonnotes/geometry-editor/GeometryMapPanel.tsx` (context header, status chips, pre-flight messages, Open Solution, Regenerate), `GeometryPropertiesWorkspace.tsx` (pass the resolved context + thumbnail), `src/components/lessonnotes/extensions/GeometryDiagram.tsx` (context from the diagram's own owner question), `src/components/lessonnotes/DocumentEditor.tsx` (owner-based context for the page layer, post-solution "Generate Map?" offer, Open Solution target).
- Unchanged: `geometryMap.functions.ts` prompt/validation (already solution-driven and symbolic-only), the geometry engine, renderer and canvas highlighting.
- No database migration.
