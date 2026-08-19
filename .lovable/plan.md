# Fix the Co-Pilot stuck on "Thinking…"

The Co-Pilot is not actually working — it is stuck on the very first step. The backend is fine: the network log shows the greeting request returning HTTP 200 in about a second, twice, with a proper greeting reply. Nothing appears in the panel because the greeting step never finishes on the screen.

Two faults, both confirmed in the code:

1. **The panel is mounted twice.** `NotebookEditorPage.tsx` renders the Co-Pilot in a desktop container (`hidden md:block`) and again in a narrow-screen drawer (`md:hidden`). CSS hides one, but React still mounts both, so both greet the backend — that is the pair of identical requests in the log, and it doubles every later call too.

2. **The greeting can leave the panel spinning forever.** In `conversation.ts` the greeting effect sets busy on, and its "greeted" flag is remembered across re-mounts. When the effect is torn down and re-run (React's development double-mount, or the panel switching containers), the second run exits early on that flag and the run that set `busy` was cancelled, so `busy` is never cleared and the stage never advances from `greeting`. Result: "Thinking…" with no structure card and no way forward — exactly what is on screen.

## What changes

1. **One Co-Pilot at a time.** The panel is mounted once and its container adapts to the screen width, so it greets once and every later call happens once.
2. **The greeting can never trap the panel.** The stage always advances to the structure card and the spinner always clears — success, failure, or torn-down request alike. If the greeting reply is lost, the panel shows the built-in opening line and the structure card, so the teacher can carry on.
3. **Every Co-Pilot call is time-bounded.** Greeting, structure acknowledgement, material analysis and chat each get a timeout using the project's existing `withTimeout` helper. A call that does not come back in time ends with a plain message ("that took too long — try again") instead of an endless spinner.
4. **The spinner is never the only state.** While a call is in flight the panel keeps the last message and the structure card visible where they apply, and a stalled call leaves a retry line in the transcript.

Not in scope: the fixed procedure, the action contract, the backend prompts, or the build logic — none of them change.

## Technical notes

- `src/pages/NotebookEditorPage.tsx`: collapse the two `CoPilotPanel` render sites into one instance; keep the responsive layout (side dock at `md`+, overlay drawer below) by switching the wrapper classes / using a single container rather than two mounted trees.
- `src/lib/lessonnotes/copilot/conversation.ts`:
  - greeting effect: drop the `cancelled` guard around the state resets so `setBusy(false)` and `setStage("structure")` always run; keep `greetedRef` but reset `busy`/`stage` when the early-return path is taken.
  - wrap `ask()` in `withTimeout(..., 45_000)` from `@/lib/async/withTimeout` and surface `RequestTimeoutError` as a teacher-facing message.
- No changes to `actions.ts`, `procedure.ts`, `StructureCard.tsx`, `MaterialIntake.tsx`, or the `notebook-ai` edge function.

## Verification

Open the note and click MathGPL Co-Pilot: one greeting appears within a couple of seconds, the structure card appears beneath it, and only one backend request is made. Confirm from the preview that the spinner clears and the structure numbers can be confirmed through to the material step.
