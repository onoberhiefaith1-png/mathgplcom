# Connect Introduction → Lines → Conclusion

No changes to how videos are created, segmented or saved. The three stages already exist; this plan only fixes the playback orchestration between them.

## What is wrong today

The board always reports a current line (Line 1 by default, before the student has done anything). The player treats that first report as a real line activation, so it immediately seeks to Line 1 and the Introduction never gets to own the opening. Everything else in the chain — line jumps, stop-at-section-end, Conclusion on the awarded mark — is already wired to one single line cursor, so Floating Numbers, Present, Next and Previous all feed the same video.

## The rules to enforce

1. **Introduction** — optional. Plays automatically, with sound, the moment the board opens, and keeps playing while the student has not activated a line yet.
2. **First activation** — the moment the student activates Line 1 (# / Floating Numbers), the Introduction stops instantly and the video jumps to Line 1's start.
3. **Lines** — each activation stops the current clip and seeks to that line's own start, then plays for that segment's full length and stops at its end. Skipping Line 2 → Line 5 plays only Line 5. Finishing a line's clip never auto-advances to the next line.
4. **One cursor** — Floating Numbers, Present, Next and Previous all move the same active line, so all four move the video.
5. **Conclusion** — optional. Never triggered by reaching or watching the final line; only by the final line's mark actually being awarded. Then it starts from its configured beginning and plays to the end without stopping early.
6. **No Introduction** → nothing plays until Line 1 is activated. **No Conclusion** → the session simply ends after the final mark.
