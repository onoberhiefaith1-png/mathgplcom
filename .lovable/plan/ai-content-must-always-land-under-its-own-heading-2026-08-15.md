# AI content must always land under its own heading

## What is going wrong

When you press AI on a **Solution** (or any section heading) the generated body is not placed under that heading. It can appear above the Exercise, in a different frame at the top of the page, or at the very bottom of the note.

Cause, confirmed in the code:

- The section's end boundary is computed by walking the **whole document** for the next heading of the same level (`computeSection` in `src/components/lessonnotes/extensions/SectionHeading.tsx:74`, and `liveSectionEnd` in `src/components/lessonnotes/DocumentEditor.tsx:903`). Neither is aware that a section may live inside a free-positioned `canvasFrame`.
- Consequence 1: if the Solution heading is the last heading inside its frame, the section end becomes `doc.content.size`, so the new content is inserted at the very end of the whole document — a completely different place on the page.
- Consequence 2: since free frames are absolutely positioned, document order is not visual order. The "next heading" can be a heading inside another frame that renders higher up the page, so the solution is written into that frame instead — "solution went up and enclosed the gap at the top".
- For a `solution` heading the append path uses `insertFrom = info.sectionEndPos` (`DocumentEditor.tsx:1052-1054`), so both consequences apply directly to solution generation.

## The rule to enforce

AI-generated content is **always enclosed under the heading it was generated from**, in that heading's own container, never above it and never in another frame or at the document end — regardless of where the sensor is parked. This applies to Solution, Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary and custom sessions alike.

## The change

1. **Container-scoped section boundaries.** Add a helper that, for a heading position, returns the heading's parent container range (its `canvasFrame`, solution cell, or the top-level document body). Section end = the next same-or-higher-level heading **within that same container**, otherwise the container's end. Use it in both `computeSection` and `liveSectionEnd` so every consumer (append, regenerate, solution lookup, geometry pass) inherits the fix.
2. **Solution insertion is anchored to its heading.** For a `solution` heading, insert directly after the heading node (after removing only the empty placeholder paragraph if present), bounded by the container end — never at `doc.content.size`.
3. **Hard guard.** Before dispatching any AI insertion, clamp the insertion position to `> headingPos` and `<= containerEnd`. If clamping fails (heading no longer exists), abort with a toast instead of writing into an unrelated place.
4. **Sensor is not consulted for section AI.** Generation from a heading's AI chip uses the heading anchor only; the sensor keeps controlling manual insertions (Section / Add Session / Add Subtopic) as it does today.

## Technical notes

- New local helper in `DocumentEditor.tsx`, e.g. `containerRangeFor(pos)`: use `editor.state.doc.resolve(pos)` and walk `$pos.depth` upward to the nearest `canvasFrame` / `solutionMath` / `solutionProse` / `doc` node, returning `{ start, end, depth }`.
- `liveSectionEnd(headingPos)` becomes: resolve container, iterate that container's children after the heading, stop at the first heading with `level <= headingLevel`, else `containerEnd`.
- Mirror the same logic in `SectionHeading.computeSection` so `sectionEndPos`, `sectionText` and `subsectionId` detection stay inside the frame.
- `findSolutionHeading`, `clearSolutionBody`, `collectDiagrams` and the async geometry insertion already derive from `liveSectionEnd`, so they are fixed by (1); only add the final clamp before each `insertContentAt`.
- No schema, edge function, or prompt changes; `getSolutionSource` (ACTIVE_QUESTION inheritance) is unaffected apart from also being clamped to the container so it cannot read a question from another frame.
