# Diagram Placement, Zoom Parity, Property Icon, and Colour-Coded Highlighting

Four fixes so a diagram always shows up where it belongs, scales with the board, announces its teacher-authored relationships, and lights up in the colour the teacher gave it.

## 1. Diagram placement — a diagram belongs to a section, in a fixed order

Today a diagram's section is only implicit: it is whatever segment's content happened to hold the drawing when the note was compiled. Nothing on the diagram records "Introduction", "Example 2", or "second diagram in this section", so ordering is fragile.

What changes:

- Each diagram gets a stored home: the owning segment (Introduction / Explanation / Example n / Exercise / Classwork / Homework / Summary), whether it sits inside that segment's Solution, and its ordinal within that segment.
- The Smartboard sequencer places diagrams from that stored home instead of re-deriving it, so a diagram can never drift into a neighbouring section or swap order with a sibling diagram.
- Non-Solution diagrams: they appear when their section opens, in the same relative position as in the lesson note (after the line of text they follow).
- Solution diagrams: they are class-note content, never floating. Two pathways, preserved exactly as described:
  - The prose above the diagram is **not highlighted** — the note row shows that prose ("The following diagram is…") and the diagram renders under it as part of the same note.
  - The prose above the diagram **is highlighted** — the diagram becomes the note on its own, revealed when the note icon is pressed.
- Guardrail: every diagram gets a guaranteed-unique stable id, so two diagrams in one section can no longer overwrite each other in the board registry.

## 2. Zoom scales diagrams too

Board zoom currently drives only handwriting and text; diagrams stay a fixed size. Zoom will scale every presented diagram by the same factor, preserving its aspect ratio and internal proportions (stroke weight, labels, and dimensions scale together — nothing gets distorted or reflowed).

## 3. Geometry-properties icon beside the diagram

- If a diagram carries teacher-authored geometry properties, a small icon appears next to that diagram on the Smartboard — in a Solution, an Example, anywhere. If it carries none, no icon appears.
- Pressing the icon opens the full relationship page: the whole screen is the diagram, with the properties list on the right — the same layout used to test properties after authoring them. A part can be clicked to see its properties, and a property clicked to light up the parts it refers to.
- A clear Close returns to the Smartboard with the lesson exactly where it was.
- The icon is per-diagram, so with several diagrams on screen each one opens its own relationships. The current global "Review properties" top-bar toggle stays as a shortcut.
