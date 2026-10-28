# Correct auto-generated square Floating Numbers

## Goal
Show a square exactly as it exists in the lesson line: `(−3)²`, `4²`, and similar expressions keep the small superscript digit, with no separate empty power/triangle structure added.

## Confirmed cause
The deterministic generator already keeps the superscript inside the Floating Number, but its structure detector also labels every `²`, `³`, or `^` as a separate `power` container. The page then renders both the correct expression and an unnecessary empty power shell (`□` with a raised `□`). Manual selection does not introduce that second structure, which is why manual creation looks correct.

## Changes
1. Update both deterministic structure detectors used by Floating Number generation so an explicit, complete exponent does not create an additional power shell.
2. Preserve a power shell only when the source genuinely contains an empty exponent slot that the student must construct; do not alter brackets, fractions, roots, or other existing structures.
3. Normalize newly generated lines on the page as a final safeguard, so explicit superscripts and a duplicate `power` container cannot be saved together.
4. Repair affected saved auto-generated lines when they are loaded, removing only the redundant power container while leaving the equation, chips, teacher edits, order, marks, and all other structures untouched.
5. Add focused tests for `(−3)²`, `4²`, and a true empty power slot, then run the relevant Floating Number tests and verify the annotated preparation view.

## Credit use
This is a deterministic code correction. Testing it will not call Copilot or AI Edit and will use no AI credits.
