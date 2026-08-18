# Remove the second diagram generated before the Solution

## What the code does today (verified)

`src/components/lessonnotes/DocumentEditor.tsx` runs an extra, fire-and-forget "geometry pass" after a question block is generated:

- `AUTO_DIAGRAM_SECTION_KINDS` (line 418) = example, exercise, classwork, homework.
- Lines 1543-1641: after the question body is inserted, it calls the backend `mode: "geometry"` with the question text, asks the model to invent a scene, then inserts a brand-new `geometryDiagram` node positioned deliberately **above the Solution heading** ("Stop at the first heading below the question heading … so the diagram sits ABOVE the Solution").

That is the added functionality producing the wrong diagram under Example. The same work also blocked the original diagram path on the Solution side: line 1305 passes `allowFigures: !isSolutionBlock`, and `materializeDirectives.ts:287-302` drops every figure directive when `allowFigures: false`.

## Changes

1. **Delete the question-side auto geometry pass.** Remove the whole `if (!skipGeometryPass) void (async () => { … })()` block, the `skipGeometryPass` / `promptAsksForDiagram` / `geometrySourceText` / `ownedDiagrams` helpers that exist only for it, and `AUTO_DIAGRAM_SECTION_KINDS`. No AI call, no scene, no node insertion for question blocks. Nothing else in the generation flow changes.

2. **Restore the original single diagram.** Stop suppressing figure directives in Solution content: pass `allowFigures: true` for every block again, so the original diagram that came with the Solution is created exactly as it was before today.

3. **Leave positioning alone.** Keep the existing "solution text lands below an existing diagram" behaviour as-is; do not add, move, or re-order any diagram. If the diagram sits after the Solution, that is accepted.

4. **Keep everything else untouched:** diagram preservation on regenerate, `diagramId` identity, ownership helpers used by Geometry Map / Properties, the 2D editor, undo history, Floating/Assign.

## Result

Generating an Exercise/Example produces **no** diagram of its own; generating the Solution produces the one original correct diagram. Exactly one diagram per question, and the wrong diagram above the Solution can never be created again.

## Technical scope

- `src/components/lessonnotes/DocumentEditor.tsx` — remove the auto geometry pass and its constants; revert `allowFigures`.
- No backend change required (the `geometry` mode simply stops being called from this path).

## Verification

Generate an Exercise with a geometry question, then generate its Solution in the live preview: confirm only one diagram exists, that it matches the question, and that no diagram is inserted between the question text and the Solution heading. Then regenerate the question and confirm the existing diagram is preserved and no new one appears.
