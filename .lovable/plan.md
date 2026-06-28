## Goal

Make geometry diagrams behave as a permanent part of the section that owns them. A diagram inserted under a question (or any section) must:

1. Never be deleted when that section is regenerated, edited in-place, or when a new section is generated below it.
2. Always remain BETWEEN the section heading it belongs to and the next heading (typically Solution).
3. Be treated by the AI as part of the question — the AI must not rewrite, describe away, or signal removal of the diagram.

## Root cause of the current bug

`handleSectionAi` in `src/components/lessonnotes/DocumentEditor.tsx` does this on regenerate / in-place edit:

```ts
editor.chain().focus()
  .deleteRange({ from: start, to: info.sectionEndPos })   // wipes EVERYTHING in the section
  .run();
```

`info.sectionEndPos` is the position of the next equal-or-higher heading (computed by `computeSection` in `extensions/SectionHeading.tsx`). Any `geometryDiagram` node living between the section heading and the next heading is included in that range and gets deleted along with the prose. Then the async geometry pass either re-generates a different scene or, if the user's edit didn't trigger a new geometry pass at the right moment, simply leaves the section without a diagram.

A secondary edge case: the fire-and-forget geometry pass captures `geometryAnchor` as a static number. If the user creates another heading before the pass resolves, the anchor can land in the wrong section.

## Fix (frontend only, no backend changes required for the structural fix)

All changes in `src/components/lessonnotes/DocumentEditor.tsx`.

### 1. Preserve geometry diagrams across section body replacement

Before the `deleteRange` in both the `replaceBody` branch and the "clear" branch, walk the range `[start, info.sectionEndPos)` and collect every `geometryDiagram` node's `attrs` (`scene`, `topic`) in document order. After the new body is inserted (and any trailing Solution placeholder is inserted), re-insert each preserved diagram at `questionBodyEnd` — keeping the invariant "diagrams sit between question body and Solution heading".

If the section is being regenerated AND the async geometry pass returns a new scene, prefer the freshly generated scene only when the teacher explicitly asked for a new diagram (heuristic: the prompt contains words like "diagram", "figure", "redraw", "triangle", "circle", etc., or the section had no diagram before). Otherwise keep the preserved one — re-running text generation must not silently replace a teacher-tuned diagram.

For the "clear" action, also preserve diagrams by default; only wipe them if the prompt explicitly says so (out of scope for this plan — keep current clear behavior but document it).

### 2. Anchor the async geometry pass to a stable position

Replace the raw `questionBodyEnd` number with a TipTap relative position. Use the editor's `state.tr.mapping` (or store the node id by inserting an empty hidden marker that we then resolve) so that if the document mutates while the geometry request is in flight, the diagram still lands at the end of the correct question body rather than at a stale absolute offset.

Simpler alternative that's good enough: re-resolve the section's end position by scanning the document for the original heading node (matched by `headingPos` mapped through `editor.state.tr.mapping` since insertion) just before inserting the diagram. If the heading no longer exists (section deleted), skip the insertion.

### 3. Defense: never delete across section boundaries

Add an assertion in `handleSectionAi`'s replace branch: re-run `computeSection`-equivalent logic against the live doc immediately before `deleteRange`, and clamp `info.sectionEndPos` to the current next-heading position. This prevents stale `sectionEndPos` values (computed before async work) from ever reaching into the next section and deleting its diagram.

### 4. Strengthen the AI prompt

In `supabase/functions/notebook-ai/geometryStandard.ts` (append to `GEOMETRY_STANDARD`) and in the section-edit prompt builder inside `DocumentEditor.tsx` (`buildPrompt`, edit branch), add these rules verbatim:

```
DIAGRAM OWNERSHIP RULE
- A geometry diagram inserted under a section belongs to that section forever.
- It sits between the section heading and the next heading. Treat it as part of
  the question/explanation it illustrates.
- When editing a section that already has a diagram, you are editing the PROSE
  only. Do not describe the diagram as removed, replaced, or moved.
- Never write "the diagram has been removed" or "see new diagram" — the diagram
  node is preserved automatically by the editor.
- When a NEW section is added below a section with a diagram, that new section
  must appear BELOW the existing diagram. Never produce content that implies
  the previous diagram should be discarded.
```

And in `buildPrompt` for the in-place-edit branch, append:
"The section may contain a geometry diagram which the editor preserves automatically. Do not mention the diagram in your output unless the teacher asked you to change it."

## Files touched

- `src/components/lessonnotes/DocumentEditor.tsx` — preserve diagrams across body replacement, stabilize geometry anchor, clamp delete range, extend the in-place-edit prompt.
- `supabase/functions/notebook-ai/geometryStandard.ts` — append the Diagram Ownership Rule block so every geometry-aware generation enforces it.

## Out of scope

- Visual rendering of `GeometryDiagram` (unchanged).
- Per-section AI scoping logic (already correct from the previous plan).
- Solution inheritance / QUESTION_LOCK rules (untouched).
- The global ribbon ("whole lesson") flow.
