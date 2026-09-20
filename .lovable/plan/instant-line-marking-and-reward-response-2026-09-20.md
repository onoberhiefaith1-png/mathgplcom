# Instant line marking and reward response

## Goal
Make Smartboard marking proactive: as soon as the current line becomes mathematically equivalent to its expected line, award its mark immediately without requiring navigation. Game Play will receive that same award and activate every configured completion reward for that line at once.

## Confirmed current behavior
- Smartboard already keeps each Floating Numbers line bound to its own writing row, so work from adjacent lines is not merged.
- The shared automatic grader already runs while a line remains active, but waits 900 ms on Smartboard and 220 ms in Game before sending the line to the marking service.
- Every text change can create another network grading request; an earlier request can also finish after newer writing unless explicitly treated as stale.
- Game rewards already subscribe to the awarded line ID and activate together once the Smartboard award arrives. Their present delay originates before that event, in line evaluation.

## Build
1. **Immediate deterministic recognition**
   - Add a browser-safe version of the same deterministic equivalence rules used by the marking service.
   - Check only the active line’s bound row against that line’s expected expression on every meaningful edit.
   - When equivalence is proved locally, submit the authoritative award immediately; uncertain mathematics continues through the existing AI-enabled marking service.

2. **Safe proactive grading coordinator**
   - Replace the long idle wait with a short coalesced check so rapid taps remain smooth and only the latest expression is authoritative.
   - Allow one in-flight check per line/expression, ignore stale responses after the student changes the expression, and never award a line twice.
   - Keep wrong/incomplete automatic checks silent; preserve manual Check feedback and all existing persistence.

3. **One line only**
   - Continue grading from the Reasoning Engine’s line-to-row binding.
   - Never concatenate another row or another Floating Numbers line into the expression being evaluated.
   - Preserve line 0 as the read-only question and keep students free to select any solving line.

4. **Immediate Game response**
   - Keep Game connected to the Smartboard’s awarded line event—no second evaluator.
   - On that event, mark the line complete and trigger its universal completion effect plus all eligible configured line rewards in the same update.
   - Preserve Vault’s separate live mathematical matching, line timers, one-time collection, reset behavior, and saved teacher design.

## Verification
- Add focused tests for current-expression freshness, duplicate suppression, independent line binding, and same-event reward consumption.
- Test rapid symbol entry where the mark appears as soon as the final equivalent symbol lands, without changing lines.
- Verify Smartboard and Game on desktop and phone: timer remains smooth, wrong partial expressions do not award, correct lines award once, and all line rewards activate immediately.
- Run the focused test suites and project type checks.

## Technical notes
- The browser check is an acceleration path, not a second source of truth: final marks still pass through the existing `grade-line` service and existing progress storage.
- Unknown or structured cases retain the service’s AI fallback; deterministic equal/not-equal cases avoid unnecessary AI latency.
- No Game Slate visuals, reward configuration, mathematical source data, or teacher-authored stage design will be changed.
