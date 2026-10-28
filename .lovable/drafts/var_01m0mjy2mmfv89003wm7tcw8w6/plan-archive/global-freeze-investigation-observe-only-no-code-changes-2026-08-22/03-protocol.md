## Per-step recording

For each of rotating building, teacher area, lesson notes (type, edit, save, switch sections, open/close panels), Smartboard (present, change sections, open/close panels, select content), assignment (open, select, assign, open assigned, go back) and Adventure (open a question, interact, return): timestamp, action, responded yes/no, new console errors, new network problems, memory and listener counts.

Then a continuous five-minute loop of ordinary navigation between those areas, then repeat the whole run 3-5 times.

## When something stops responding

Freeze the evidence first:
1. No refresh, no navigation, no code change.
2. Record time, page, route, last successful action, failed action, control clicked, expected vs actual.
3. Scope test: click controls in unrelated areas — one broken control (local), several on one page (page/component), controls everywhere (shared/global layer).
4. Inspect in the frozen state: console errors and rejections; requests still pending or repeating; which element sits under the pointer at the click point and whether an invisible overlay intercepts it; whether any pointer capture is still held; whether a loading flag stayed true; whether the main thread is blocked by a long task; heap growth and leaked listeners/timers/channels/WebGL contexts across runs.
5. Compare the working snapshot against the frozen snapshot from the same run.

## Report you get at the end

Did it freeze; where first; last successful action; first failed action; local or global; console errors; network problems; stuck application state; strongest evidence-based root cause; confidence LOW/MEDIUM/HIGH — with the timeline that narrows the freeze to a specific interval.

No fix is proposed in this run. Once the cause is named with evidence, we agree separately on the correct fix.

## Technical notes

- Driven headlessly against the running app with the teacher session; instrumentation lives in the browser session only, nothing is written into the project.
- Screenshots at each step and at the moment of failure are part of the record.
- If no freeze appears in 5 runs, the report says so and lists the resource trends observed (heap, listeners, pending requests) rather than guessing a cause.
