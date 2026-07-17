Plan: clean rebuild the hashtag math editing path from scratch.

1. Remove the interlocking hashtag implementations
   - Stop registering and remove the current `MathLevel` shortcut system that turns ordinary text into level-marked superscripts/subscripts.
   - Remove the old `#` promotion path that creates the atom-like `mathInline` canvas.
   - Keep unrelated productivity shortcuts only where they do not touch `#`.

2. Build one fresh hashtag engine on top of editable math slots
   - Use the existing editable `mathStructure` / `mathSlot` model as the base, because its slots are real cursor-editable regions and can nest indefinitely.
   - `x#` converts the object immediately to the left into a `subsup` math tree structure with three editable branches:

```text
      power slot
base
      subscript slot
```

   - The cursor lands in the power slot.
   - `x##` lands in the subscript slot instead, without leaving either `#` visible in the note.
   - If there is no parent object to attach to, `#` remains literal text.

3. Support true branch editing and re-entry
   - Every branch is a real editable slot, not one fixed image/chip/string.
   - Teachers can click back into base, power, or subscript slots and edit characters normally.
   - Nested structures must work inside any slot: `x#2#5#n`, fractions, brackets, matrices, roots, and further scripts can be created inside branches.

4. Arrow-key navigation
   - Left/right should move through normal characters and into/out of structures.
   - Up/down should move between sibling branches of the current math structure: power ↔ base ↔ subscript, numerator ↔ denominator, matrix cells where applicable.
   - Space exits one level when inside a math branch; only at normal prose level does it insert a real space.

5. Styling: natural typing, not a chip
   - Remove the orange/boxed atom feel from the hashtag-created math.
   - Render scripts like natural typed mathematics: compact, baseline-aligned, with subtle empty-slot placeholders only while editing.

6. Testing before calling it done
   - Run a targeted typecheck/build signal.
   - Use Playwright on the lesson note editor to test these flows visually and functionally:
     - `x#2` creates superscript with no `#` shown.
     - `x##n` creates subscript with no `#` shown.
     - `x#2` then arrow/down editing can add a subscript to the same `x`.
     - Nested branch example such as `x#2#5#n` remains editable by arrow/click navigation.
     - Re-clicking an old branch lets the teacher edit inside it again.