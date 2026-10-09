## Implementation

- Adjust only the Geometry Map property composer; the shared maths editor remains unchanged elsewhere.
- Make the outer property-writing box the focus and click target for the maths editor.
- Remove the shared editor's focused outline in this one context, eliminating the middle rectangle without removing its caret, selection, or structural-maths behaviour.
- Give the outer surface a stable full width and generous minimum height, with content-driven height growth and visible overflow for fractions and other tall structures.
- Keep diagram-reference shells and their colours exactly as they are.

## Checks

- Type a long property and confirm no tight equation-level outline appears.
- Insert `AB` and `AC²`; both retain their small coloured shells.
- Add a fraction and type in its numerator and denominator; the large surface grows vertically and nothing is cut off.
- Add powers, roots, and brackets; caret navigation and editing remain intact.
- Click diagram parts while composing; references insert into the same large surface and the Geometry Map page remains open.
- Confirm Add property, Undo, Clear, and the function menu still work.
