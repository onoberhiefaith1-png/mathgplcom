# Diagrams travel with questions, with properties written underneath

## What the teacher and student will see

1. **Question diagram goes everywhere the question goes**
   - If a lesson-note question has a diagram (or the question *is* only a diagram), that diagram appears with it on the Smartboard, in Assignments, in Academia Practice and Play, and in the Game (online and offline Mathemagine).
   - Order and spacing copy the lesson note: question text, a gap, the diagram, a gap, then Line 1. The diagram never sits on top of the text.
   - In the Game, the diagram goes on the **question writing surface** (the first surface), never on Line 1. That surface grows taller to fit the diagram. A diagram-only question still gets its question surface.

2. **Properties appear under the diagram, on every device**
   - The side panel that slides in from the right is removed for these diagrams on laptops and tablets as well.
   - Tapping a part of the diagram (for example side x) writes its property straight under the diagram, like a line of text: "x = 30 / 15". Everything below moves down to make room, so nothing overlaps.
   - Tapping another part replaces it. Tapping the same part again, or a small X, removes it and the space closes.
   - Inside a Game writing surface, the property line appears inside the same surface under the diagram, and that surface grows to fit it.
   - Diagrams stay clickable at all times wherever they have geometry properties. Diagrams without properties display normally and can't be clicked.

3. **Diagrams inside a solution are notes**
   - A diagram placed inside the solution is not a line to answer and is never highlighted for marking. It is a note: it appears when that note's step is reached, and it is clickable with properties written underneath in the same way.

4. **Speed**
   - Diagram drawings are prepared once per question and only drawn when on screen. Clicking one only redraws that diagram and its property line, so the Game doesn't slow down.

## Permission note
The Game is currently locked against changes. Approving this plan unlocks only the Game's question writing surface and note surfaces so they can show diagrams and property lines. Writing, scoring, timers, lives, rewards, saved line positions and progression stay as they are.

## Technical details
- Extend the board contract (`AssessmentQuestion`/`GameQuestionBoard`, `compileOfflineBoard`, `buildAssessmentBoardSource`) with an optional `questionDiagram` (saved `GeometryScene` + authored zoom/offset) and per-line `noteDiagram`; read them from the question block and solution note blocks when compiling. Bump `ACADEMIA_PACK_SCHEMA` so offline packs refresh.
- New shared `InlineDiagramProperties` component: renders the selected property statement(s) in normal flow below the diagram (reuses `ReviewPropertiesPanel` data / `renderStatement`, not the panel shell). Used by `ReviewableBoardDiagram` for all breakpoints; remove the right-side panel and fullscreen relationship page entry for presented diagrams (teacher geometry editor test page untouched).
- Game: the question surface in `TableActivityStage`/PresentationView game chrome measures diagram + property height and grows; note surfaces render `noteDiagram` the same way. Surfaces resize via measured height (ResizeObserver), not reflow of other lines.
- Assignments/Practice/Play pages render the same question header component, so one change covers them.
- Diagram scenes memoised; `PresentationGeometryDiagram` lazily mounted with IntersectionObserver.
- Tests: board compile keeps the question diagram on the question (not Line 1); solution diagram becomes a note with 0 marks; diagram-only question still compiles; property toggle selects/replaces/clears.
- Update `mem://constraints/game-locked.md` to record this unlocked scope.
