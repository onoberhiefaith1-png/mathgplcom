# Restore the lesson-note editor before the overlap change

## Restoration

- Restore the project checkpoint immediately before the implementation prompted by “text should never overlap.”
- This reverses that whole change set together, including its edits to lesson-note frame positioning, sensor placement, and session layout.
- Do not add a compensating code patch; restoring the prior checkpoint avoids leaving partial layout behavior behind.

## Expected result

- Lesson notes return to the exact earlier behavior the teacher said was manageable.
- The newly introduced movement, duplicate-looking Example/Solution placement, and question/solution mixing from that change set are removed.
- Later investigation of text overlap can begin separately from the restored baseline if requested.

## How to apply

Use the chat message’s revert control for the implementation immediately after the overlap request, or select the preceding checkpoint in History. Changes after that checkpoint will be archived and can be reapplied later.
