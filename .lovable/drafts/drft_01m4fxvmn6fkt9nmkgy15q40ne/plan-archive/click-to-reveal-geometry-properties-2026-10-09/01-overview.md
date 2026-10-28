# Click-to-reveal Geometry Properties

## Outcome
- Lesson-note diagrams return to their normal writing colour. Saved relationship colours will never remain painted on the resting diagram.
- On the Smartboard, tapping a diagram part reveals only the teacher-defined properties connected to the selected part or parts.
- Tapping a selected part again removes it. With no selected parts, the diagram and property area return to the neutral state.
- Desktop and tablet keep the diagram and properties side by side. Phone places the properties directly beneath the diagram.
- Existing multi-part selection, property filtering, Reset, and property-to-diagram highlighting remain intact.

## Verified current behaviour
The shared diagram renderer currently reads saved Geometry Map colours even when nothing is selected. That is why colour persists in lesson notes. The Smartboard already tracks selected parts and filters properties, but normal diagram tapping is only enabled after the review state is open. Its current small-screen dock is a bottom overlay rather than content arranged beneath the diagram.
