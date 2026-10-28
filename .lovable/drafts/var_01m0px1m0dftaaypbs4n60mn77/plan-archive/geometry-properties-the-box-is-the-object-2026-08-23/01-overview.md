# Geometry properties: the box is the object

Today a picked diagram part is inserted into a property as **plain text**, and the link back to
the geometry is recovered by searching the statement for that text
(`statement.includes(label)`). That is why renaming or clearing a label breaks the property, and
why colour follows the wording instead of the geometry.

This rebuild makes the **selection box a real object reference** inside the property expression.
The box carries the geometry id. Whatever the teacher types inside it is only a label.

What changes for the teacher:

- Picking a part of the diagram drops a coloured **box** into the property line, pre-filled with
  that part's label (`EF`).
- The label inside the box can be edited, emptied, or replaced by anything (`Y`, `12cm`, `x`) —
  the box still means segment E–F.
- A small **×** on the box (shown when the box is focused or hovered) deletes the whole
  reference. Deleting the label never deletes the reference.
- Automatic colours follow one fixed order: **Black → Blue → Red → Purple → Green → Orange**, then
  repeat. Manually recolouring an object does **not** move the sequence forward.
- One geometry object keeps one colour everywhere: diagram stroke, its diagram label, every
  property that mentions it, the Smartboard highlight, and the review panel.
- Clicking a coloured object reveals every property attached to that object, not just the last one.
