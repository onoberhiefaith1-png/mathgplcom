## Technical details

1. **Normalize at the Geometry boundary**
   - Add one Geometry-specific conversion path that understands structural geometry references before normal math normalization.
   - Convert legacy or malformed stored forms into renderable structure without changing object identity.
   - Ensure any last-resort fallback strips internal commands instead of printing them.

2. **Keep editing visual**
   - Reuse the structural math tree for both new and saved relationships.
   - Load a saved formula back into that tree, retain geometry-reference IDs, and serialize it only when saving.
   - Keep ordinary prose fields such as the principle name and explanation unchanged.

3. **Unify every output**
   - Route Geometry Map cards, the student guide, pathway entries, and Smartboard properties through the same classroom renderer.
   - Continue colouring AB, CA, and BC by their linked diagram object IDs.

4. **Verification**
   - Test `BC² = AB² + CA²` and its structured equivalent with three diagram references.
   - Assert the visible result contains the labels and superscript 2, with no backslash commands, braces, caret notation, or geometry-reference macro text.
   - Check both authoring and read-only display paths.
