# Lossless Symbol Pass-Through for Floating Numbers

## Goal
Make every complete symbol or structure selected from a Solution reach Floating Numbers unchanged in both Smartboard engines. This applies to set notation, matrices, sums/products, calculus, physics, chemistry, Unicode glyphs, and future notation—not only the marked curly braces.

## Confirmed problem
The current path is not lossless. Several stages recognize a fixed list of commands or structures and can discard anything outside it:

- The shared symbol parser drops unknown commands instead of preserving them.
- Client and server normalization use different finite allowlists.
- Floating Numbers filters out chips it labels “dirty,” even when they contain legitimate notation.
- The frontend and server extractors are duplicated and detect different subsets of structures.
- The server’s initial “has maths” check recognizes only a narrow symbol set.

The authoritative presentation model already copies saved equations and fillers exactly, so the repair belongs before that model and at the display boundary.

## Implementation
1. **Create one lossless notation contract**
   - Preserve every non-empty source grapheme and every balanced structure.
   - Convert known notation into editable structured objects where supported.
   - Preserve unknown-but-valid notation as an opaque, selectable chip rather than deleting it.
   - Reject only malformed or unsafe source syntax; never reject a complete symbol merely because it is unfamiliar.

2. **Unify extraction in both engines**
   - Update the shared/client and server Floating Numbers extractors so set braces, large operators, matrices, vectors, accents, derivatives, chemistry arrows, physics symbols, and arbitrary Unicode survive.
   - Replace finite “has maths” detection with content-based extraction so symbol-only expressions are not skipped.
   - Keep existing rules for splitting terms, equation sides, timing, and teacher-selected groups.

3. **Remove lossy gates**
   - Change Unicode normalization, display validation, and Floating Numbers chip checks to preserve legitimate unknown commands/structures as opaque content.
   - Keep safeguards for broken braces, incomplete commands, private sentinels, and programming syntax.
   - Ensure editable Floating Numbers and saved plans do not silently filter preserved chips.

4. **Keep storage and presentation exact**
   - Preserve teacher-authored equation text, selected fragments, order, line identity, and containers through save/reload.
   - Confirm Floating Numbers and Present Mode consume the same preserved reservoir without reconstructing or substituting content.

5. **Regression coverage**
   - Add a corpus covering `{a,b,c}`, `P ∪ Q`, intersections/complements, `∑`, `∏`, integrals, limits, matrices/determinants, Greek and physics symbols, vectors, reaction arrows, subscripts/superscripts, unfamiliar Unicode, and unfamiliar balanced commands.
   - Assert conservation: normalized source content equals the combined output content, with no symbol disappearing.
   - Test highlight → generation → save/reload → both Smartboard engines → rendered output.
   - Retain tests proving malformed structures are rejected safely.

6. **Verification**
   - Run focused parser, Floating Numbers, persistence, and renderer tests.
   - Open the marked set-expression example in the preview and verify curly braces and union notation reach Floating Numbers.
   - Verify a mixed matrix/calculus/physics/chemistry sample in both engines.
   - Check the final preview build and browser console.

## Technical scope
Primary areas: Floating Numbers extractors, notation normalization/tokenization, atom parsing, validation/display gates, saved-plan preparation, editable Floating Numbers, Smartboard chip rendering, and their focused tests. Existing mathematics, timing, activation, layout, and reward behavior remain unchanged.
