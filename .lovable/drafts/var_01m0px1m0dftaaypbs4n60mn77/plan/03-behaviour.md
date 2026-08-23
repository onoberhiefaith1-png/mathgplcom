# Behaviour rules

## Selection box
- Picking any selectable part (segment, angle, point, arc, circle, shape, region) inserts one box
  bound to that part's stable scene id. Same architecture for every geometry type.
- The box body is a normal editable slot: type, clear, or replace freely — letters, numbers,
  variables, units, or a full expression.
- An empty box stays visible as an outlined coloured cell so the teacher can see the reference is
  still there.
- The × control appears on the focused/hovered box only, and deletes the box plus that object's
  link from the property being edited. Other properties referencing the same object are untouched.

## Colour
- Sequence: Black, Blue, Red, Purple, Green, Orange, repeating. Stored per object id.
- An object that already has a colour keeps it, and being reused in a second or third property
  never re-colours it.
- Manual recolour writes the object's colour only. The sequence counter does not move.
- Palette offered to the teacher: the same six colours.

## Properties per object
- Clicking a coloured object (in the editor or on the Smartboard) lists **every** property that
  references that object.
- Clicking a property highlights each referenced object in its own colour, so a single relationship
  reads as colour-coded geometry rather than one flat accent.

## Compatibility
- Properties authored before this change keep working: their existing text-to-id bindings still
  colour by matched wording. New authoring always uses boxes.
