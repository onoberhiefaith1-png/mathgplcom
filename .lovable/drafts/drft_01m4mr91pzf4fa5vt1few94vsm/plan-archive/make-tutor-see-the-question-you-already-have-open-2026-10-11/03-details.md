## How you'll check it

Open any Academia Practice question online, open Tutor and say "give me a full tutorial guide". The Guide should open beside the board and start reading that question's steps. Then try "next step", "why?", and "stop".

## Technical details

- **Shared board registers the Guide.** `PresentationView` already holds the current question and its `guidedLines`. It will register the `guide.start` / `guide.stop` tutor actions while a question with stored lines is shown. It will also open an optional `TutorGuide` side panel, using the same split layout the offline app uses (`OfflineActivity.tsx`). Board scoring and the assignment controls are not touched. The offline app keeps its own Guide button.
- **Screen context.** Add a small `screenContext` store to `src/lib/assistant/actions.ts`. Screens publish `{ page, questionTitle?, hasSolution, available: string[] }` while they are open. The available list comes from the registered actions. `MathGPLTutor` sends this with each `understandRequest`, and `describeApp` adds an `ON SCREEN NOW` block. The brain is told never to ask the teacher to open something listed there.
- **Better "missing screen" handling in `bus()`.** If the action exists on the current screen, run it straight away. If a question is open but has no stored solution, say exactly that. Otherwise, keep the command as `awaiting` instead of dropping it.
- **Retry on follow-up.** If a command is awaiting, a reply like "done / opened / ready / yes", or a new action appearing on screen (`waitForTutorAction`), runs it once. Never more than once, and it clears after 2 minutes.
- **Tests** (`src/lib/assistant/__tests__`): the screen context is included in the map; "I have opened it" re-runs the waiting guide request exactly once; a question without stored lines gives the "no saved solution" reply.
- Record in `AGENTS.md`: question screens publish their context to Tutor through the action bus, so Tutor never guesses what is open.
