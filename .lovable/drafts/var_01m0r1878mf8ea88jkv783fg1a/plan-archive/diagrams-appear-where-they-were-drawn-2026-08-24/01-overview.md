# Diagrams appear where they were drawn

On the Smartboard every diagram currently ends up in one pile at the bottom of the section instead of sitting where it sits in the lesson note. Three separate places cause it, and all three are fixed together.

## What is happening now

- A question/example section collects **all** of its diagrams — the question's own diagram, plus every diagram drawn inside its Solution — into a single group that renders after the question text. Their recorded position in the text is ignored on this path (the intro/explanation/summary path already interleaves correctly).
- A Solution with no highlighted lines attaches **all** of its diagrams to the **last** note row, so several diagrams land together at the end of the solution instead of at their own lines.

## What will change

1. **A diagram renders at its own line, in every section type.** Question and exercise sections use the same line-by-line interleaving already used for Introduction / Explanation / Summary: the diagram appears after the exact line of text it follows in the lesson note, and two diagrams in one section keep their authored order.
2. **A Solution diagram stays in the Solution.** It is no longer folded into the question's object pile. It travels with the Solution note stream, keeping the two pathways already agreed:
   - prose above it not highlighted → the note row shows that prose and the diagram under it;
   - prose above it highlighted → the diagram is the note revealed by the note icon.
3. **Note rows distribute diagrams by position.** Each unhighlighted-prose note row receives only the diagrams that belong to its own lines; leading diagrams get their own row above the first prose row. No more dumping onto the last row.
4. Ordering everywhere stays driven by the already-stored placement home (section → position within section → line), so the board never re-derives placement and a diagram can't swap with a sibling.
