## Technical changes

### Player readiness and autoplay

In `QuestionVideoPane.tsx`, make Introduction startup readiness-driven rather than render-driven:

- Keep the Introduction pending while the media URL or `<video>` element is not ready.
- Start from the Introduction timestamp on `loadedmetadata`/`canplay` (with one guarded retry path), and set its one-shot guard only after the playback request is issued against the mounted element.
- Preserve the current sound-first request and muted fallback, but surface play rejection instead of silently leaving a paused black frame.
- If Introduction is disabled or has no playable segment, do not select or play another section automatically.

### Explicit playback session reset

Report a small playback reset generation from `PresentationView` through the existing line context. Increment it on the existing reset/restart action. `QuestionVideoPane` will use that event to:

- pause and return to the opening state;
- clear `introDone`, handled-line, Conclusion, and Conclusion-hold guards;
- restart the Introduction once media is ready, or wait when no Introduction exists.

A normal remount/open already creates a fresh player; the explicit generation covers reset without requiring a remount.

### Hashtag → Line 1

Wrap the permanent Floating Numbers `#` activation so opening it marks the current line as engaged. This must emit an activation even when `activeLineIdx` remains `0`; relying only on an index change cannot activate Line 1 because the board starts with its cursor there already. Keep the existing cursor and panel behaviour unchanged.

### Final mark → Conclusion

Retain the existing newly-awarded-slot event as the sole trigger. Harden the player boundary handling so the active Conclusion is allowed to run to the media’s actual end, then release its hold on `ended`; ordinary line sections still pause at their own end and never auto-advance.

## Verification

Add focused orchestration tests for:

- delayed media readiness still starts the Introduction;
- sound-on autoplay rejection falls back to muted playback instead of pausing;
- no Introduction means no playback before activation;
- clicking `#` while already on Line 1 interrupts the Introduction and plays Line 1;
- reset starts the Introduction again;
- visiting the final line does not start Conclusion;
- awarding the final mark starts Conclusion and it reaches media end;
- finishing any line segment does not move to the next line.

Then run the real exercise Smartboard in the browser with a saved teaching video and verify the playhead transitions for Open → `#` → final-mark → Conclusion, plus Restart → Introduction.
