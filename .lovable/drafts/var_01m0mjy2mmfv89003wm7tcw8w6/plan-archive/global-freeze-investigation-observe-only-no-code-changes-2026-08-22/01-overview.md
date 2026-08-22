# Global Freeze Investigation — observe only, no code changes

Goal: answer one question with evidence — why does the app sometimes stop responding to clicks until a full refresh?

Rules for this run:
- No code changes, no anti-freeze, no recovery, no prefetching, no performance work.
- No assumption of cause. No "fixed" claim.
- If a freeze happens, the frozen state is preserved and inspected before anything else.

## What I will actually do

I drive the real app in an instrumented browser session, starting at the rotating building, exactly as a teacher would, and record everything with timestamps.

Instrumentation attached before the first click (read-only, injected into the browser session only, nothing saved into the app):
- console messages and uncaught errors/promise rejections
- every network request with start time, end time, and any request that never resolves
- long-task and frame-drop timing, plus JS heap size sampled each minute
- after every click: whether the DOM changed, whether the route changed, and what element is actually receiving the click at that point
- a count of live listeners, timers, realtime channels and WebGL contexts, sampled each minute
