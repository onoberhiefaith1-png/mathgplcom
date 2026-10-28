# Final diagram quality + Co-Pilot freeze fix

Two separate problems, both confirmed in the code.

## 1. Diagram lines are too heavy

The shared diagram renderer draws every line at a fixed weight (`sw = 1.4` in `GeometryDiagram.tsx`) and then the whole figure is scaled up for display (up to 1.4× in "large" mode). The scale multiplies the line weight but not the label weight, so lines end up visibly heavier than the numbers beside them — exactly what the screenshot shows.

What changes:

- Line weight becomes scale-aware: the renderer computes the display scale and thins the stroke so the drawn weight lands at examination-textbook thickness (about 1.1px on screen) whatever size the figure is shown at.
- One shared set of ink weights: main construction lines slightly lighter, tick/angle marks lighter again, so hierarchy reads as figure → marks → labels rather than heavy lines shouting over the text.
- Labels are untouched: dark ink (`#0f172a`), same sizes, same placement. No geometry, coordinates, or construction logic changes — this is stroke styling only.

## 2. Co-Pilot appears to freeze, and there is no way out

Confirmed causes:

- A Co-Pilot request has no cancellation. `ask()` in `conversation.ts` is only time-bounded (120s); until it returns the panel shows a spinner with no way to stop it, and a slow build feels like a frozen workspace.
- Nothing prevents a duplicate request. Pressing Enter, Confirm or Approve twice starts a second identical call.
- During a build, each item runs to completion before the pause flag is read, so "stop" can be a long wait.

What changes:

1. **A real Cancel.** Every Co-Pilot call gets an `AbortController`; the panel shows a Cancel control next to the working line while a call is in flight. Cancel aborts the request immediately, clears the spinner, returns the panel to the stage it can act from, and says so plainly. The reply of an abandoned request is discarded instead of arriving later and confusing the transcript.
2. **No duplicate requests.** Sending, confirming the structure, planning, revising and approving all refuse to start while a call is already running; the panel says it is still working instead of queueing a second call.
3. **The build stops when asked.** The build loop checks the cancel/pause flag before each item and between the question and its solution, so stopping takes effect at the next safe point. Everything already built stays; the run can be resumed with "Carry on building".
4. **A Co-Pilot failure never blocks the lesson note.** The panel keeps its own error state (already crash-isolated by `FeatureBoundary`), and the spinner is always cleared on success, failure, timeout or cancel — so the editor itself is always usable.
5. **State survives a refresh.** Conversation, structure, blueprint and build queue already persist per note; cancel is recorded in that same state so a refresh comes back at the stopped point rather than mid-flight.

Not in scope: the fixed Co-Pilot procedure, the backend prompts, the Math Engine, and the geometry construction logic.

## Technical notes

- `src/components/lessonnotes/GeometryDiagram.tsx`: derive `scale = displayW / W`, pass a stroke weight into `renderObject` (replacing the local `const sw = 1.4`), with separate weights for construction lines and for tick/angle/parallel marks, clamped to a sensible range.
- `src/lib/lessonnotes/copilot/conversation.ts`: add `busyRef` + `markBusy`, `abortRef` (`AbortController`) and `cancelledRef`; pass `signal` into `supabase.functions.invoke`; add an exported `cancel()`; treat `AbortError` as silent in every catch; guard `send`, `confirmStructure`, `planLesson`, `reviseBlueprintItem`, `runBuild` and `execute` on `busyRef`; check the cancel flag inside the build loop.
- `src/components/lessonnotes/copilot/CoPilotPanel.tsx`: render a Cancel button beside the working line while `busy`, wired to `cancel()`.
- No changes to `actions.ts`, `procedure.ts`, `session.ts`, the `notebook-ai` edge function, or the geometry construction engine.

## Verification

In the preview on a real note: generate a figure and confirm lines and labels read at matching weight (no bold outlines). Start a plan or build, press Cancel mid-call, and confirm the spinner clears at once, the panel says it stopped, the editor stays fully usable, and a refresh returns to the same point.
