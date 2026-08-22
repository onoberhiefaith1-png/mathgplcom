# Behaviour details

**Typing.** The property line accepts letters, digits and operators exactly as typed, so
`5`, `12`, `x`, `= 5` and `TA#2 = TB*TC` all work with no special buttons. The established
shortcuts keep their existing meanings: `/` turns the term on the left into a fraction,
`#` builds a power, `##` an index, `(` `[` `{` `|` auto-pair, `@` opens the asset picker.
Nothing about those rules is redefined for geometry.

**Picking from diagram.** Unchanged button and unchanged behaviour: with picking active,
each clicked object inserts its reference at the caret. Its internal id is recorded on the
property separately from the visible expression, so a relabelled point never breaks the link.
Removing a picked reference from the expression drops its id from the property.

**Add Function.** Compact menu (root, fraction, superscript, subscript, parentheses, angle,
degree, sin, cos, tan). Choosing an item inserts the structure at the current caret and puts
the caret in the slot the teacher will type into next; the rest of the expression is untouched.

**Saving.** Save writes the same property record as today — displayed expression, reason, and
the list of referenced object ids — onto the diagram, so it survives refresh, reopening the
diagram, the class copy, slides and published snapshots. No database change.

**Mobile.** The input is a normal focusable field, so the phone or tablet keyboard opens on
tap. No application keyboard is shown on any device.
