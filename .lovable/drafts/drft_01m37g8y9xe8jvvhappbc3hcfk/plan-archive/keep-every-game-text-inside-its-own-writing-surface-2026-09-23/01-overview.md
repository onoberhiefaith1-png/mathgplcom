# Keep every Game text inside its own writing surface

## Confirmed problem

The screenshot shows the question equation beginning at the far-left edge of the screen while its white writing surface begins farther right. The current code confirms that Game questions use the structured-mathematics renderer, while ordinary text uses a separate renderer. The structured path adds its own HTML positioning and reports bounds differently, so the existing surface containment rule is not reliably controlling the visible equation.

## Result

- Question text, working and notes will share one inner writing box with their physical surface.
- The **Text** icon will immediately reapply that contract to every visible line.
- Edit, teacher Play and student Play will render from the same coordinates.
- Saved teacher wording, surfaces, text settings, rewards, marks and progress remain unchanged.
