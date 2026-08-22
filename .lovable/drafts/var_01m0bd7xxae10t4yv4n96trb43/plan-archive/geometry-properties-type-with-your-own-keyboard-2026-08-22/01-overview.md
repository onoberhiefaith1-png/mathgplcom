# Geometry Properties — type with your own keyboard

The on-screen mathematical keyboard inside Teacher Edit goes away. In its place, the
property line becomes the same live mathematics editor the Lesson Note lines and Smart Table
cells already use, so the teacher types with the laptop, tablet or phone keyboard and the
existing shortcuts do the formatting.

What stays exactly as it is: Picking from diagram, the Reason / Name field, Save,
the diagram editor, the selection system, storage on the diagram, and the Smartboard.
Nothing about the Geometry Properties system itself is redesigned, and no AI is added.

## The three inputs, in one line

1. **Pick from diagram** — clicking a point, line, segment, angle or arc inserts that
   object's reference at the caret and records its internal id.
2. **Keyboard** — plain typing: letters, digits, `=`, `-`, `*`, and the established
   shortcuts (`/` fraction, `#` power, `##` index, auto-pairing brackets, `@` asset
   picker). Same parser, same meanings — none of it is re-implemented or re-defined here.
3. **Add Function** — a compact menu that inserts a structure at the caret: square root,
   fraction, superscript, subscript, angle, degree, sin, cos, tan, parentheses.
   It inserts into the expression; it never replaces it.

So `YP` (picked) → `=` typed → Add Function - Square Root → `S#2-Z#2` typed gives
`YP = √(S² − Z²)`, with `YP`, `S` and `Z` still bound to their real geometry objects.
