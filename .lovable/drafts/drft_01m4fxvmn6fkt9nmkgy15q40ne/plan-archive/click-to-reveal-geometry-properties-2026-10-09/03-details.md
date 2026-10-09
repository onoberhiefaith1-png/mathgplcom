## Interaction details
1. Render all unselected diagram objects with the current lesson-note or Smartboard ink colour; keep saved relationship colours as metadata only.
2. When a part is tapped, open the review area if needed, add or remove that stable object identity, and colour only the active highlights with the teacher-authored colour.
3. Filter the visible equations by the complete current selection. Selecting a property may highlight all parts used by that property; closing or Reset clears every temporary colour.
4. Use one responsive review composition: side-by-side from tablet upward, and a vertical diagram-then-properties flow on phones. The phone content remains scrollable without covering the diagram.

## Safeguards and checks
- Add a renderer test proving saved colours do not paint an unselected lesson-note diagram and do paint the selected object.
- Extend selection tests for tap, second-tap removal, Reset, and multiple-part intersection filtering.
- Check the same saved diagram in lesson-note, teacher Smartboard test, student Smartboard, desktop/tablet, and phone widths.
- Preserve the Geometry Map itself, its stored colours, teacher equations, and existing lesson-note editing behaviour; this is presentation and interaction work only.
