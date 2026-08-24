# Board B Correction — Teacher's Live Working Board

Board B stops being a "second lesson note with tools" and becomes what it was meant to be: the teacher's live working board that automatically carries across only the diagrams and graphs of the current lesson section.

## What changes

1. **Only diagrams and graphs are extracted.**
   Board B receives 2D diagrams, 3D diagrams, geometry diagrams, mathematical diagrams and graphs from the current lesson section. Nothing else.

2. **Tables stay on Board A.**
   Tables return to the main teaching board exactly as they worked before this change. Example 2 → Question → Table stays on Board A and never appears on Board B.

3. **Calculator and Conversion Companion removed from Board B.**
   The Calculator and Conversion tabs are deleted from Board B. Both keep working exactly where they already live. No duplicate, no companion section.

4. **Board B has two parts, top to bottom:**
   - **Extracted content** — the diagram/graph of the current section, labelled with its section ("INTRODUCTION", "EXAMPLE 1", "EXAMPLE 2"). It is the same object, not a copy: identity, properties, labels, colours, graph configuration and mathematical relationships are unchanged, because it is rendered through the existing diagram/graph renderers.
   - **Teacher Working Area** — a blank live workspace underneath where the teacher can draw, write, annotate, add working, sketch another diagram or use a graph while teaching.

5. **No diagram/graph in the section?**
   Nothing is extracted and no placeholder section is invented. Board B simply opens as the teacher's working area.

6. **Board B is never a copy of the lesson.**
   No Introduction/Explanation/Exercise/Conclusion structure is reproduced — only the visual object belonging to the current position.

7. **Teacher additions stay on Board B.**
   Anything the teacher draws or writes in the working area never modifies the lesson note on Board A.

8. **Synchronisation without resetting.**
   Moving through the lesson (Introduction → Example 1 → Example 2) updates the extracted object at the top. The teacher's working content is preserved for the session and is not wiped by moving between sections or between boards.

## Technical notes

- `src/lib/smartboard/boardAssignment.ts`: Board B membership becomes `family === "diagram"` (which already covers 2D/3D geometry, scenes, charts and graphs). Tables, equations, text, emojis, images and everything else resolve to Board A. `splitObjectsByBoard` keeps its signature, so Board A's `BeatBlock`/`FlowingTextAndObjects` rendering automatically gets tables back.
- `src/components/smartboard/InteractiveBoard.tsx`: drop the `Mode` tab system (calculator/conversion/companion). Render a single scrolling column: section label + extracted diagram/graph objects via the existing `SolutionObjectView`/reviewable-diagram path (so Geometry Properties and its Smartboard test keep working), followed by a "Teacher Working Area" region.
- Working area reuses the existing blank companion Lesson Note surface (`CompanionNoteBoard`'s editor, persisted on the notebook's `companion_json`) mounted once — not per section — so it persists across section and board switches and never touches lesson-note content.
- `PresentationView.tsx`: `boardBObjects` continues to feed Board B; the `SmartCalculatorBody`/`ConversionBody` imports inside Board B are removed. Zoom continues to be threaded so extracted objects scale with the board.
