## Playback rules

| Event | Video behaviour |
| --- | --- |
| Board opens, Introduction exists | Seeks to the Introduction start and plays with sound. |
| Introduction reaches Line 1 start | Stops there. Nothing auto-continues. |
| Student activates Line *n* (Floating Number, Present, or board cursor) | Interrupts whatever is playing, seeks to Line *n* start, plays. |
| Playhead reaches a section `end` | Pauses at that exact point. |
| Student stays on a line | Plays the whole configured range, however long. |
| Student returns to a line whose mark is awarded | Seeks to it, does **not** auto-play. |
| Student returns to a line with no mark yet | Plays it. |
| Player Previous / Next / Replay | Moves only the video, at any time, awarded or not. |
| Final line's mark is awarded | Conclusion plays once, if configured. |
| No Introduction / no Conclusion | Nothing plays until Line 1 is activated. |
| View switch, volume change, mute | Nothing reloads; position and audio continue. |

## Student vs teacher

- **Student:** awarded marks and completion persist; the awarded-mark rule above suppresses auto-replay.
- **Teacher test mode:** every entry starts a fresh test session — no marks, no "already played" memory, so Line 1 replays after leaving and returning. Nothing is written as student progress.

## Layout

One vertical control stack at the top of the board, never overlapping:

```text
row 1   Back to Smart Card | Practice Set / lesson info | marks
row 2            [ Smartboard ] [ Split view ] [ Video ]
        ────────────────────────────────────────────────
                board content (padded clear of both rows)
```

- **Smartboard view:** board is the whole surface; the player is kept mounted off-screen so audio keeps running and stays in sync.
- **Split view:** board and player side by side on wide screens, stacked rows on narrow ones. The video keeps its own aspect ratio — letterboxing is accepted, distortion is not.
- **Video view:** the player takes the whole area, `object-fit: contain`, no crop, no stretch.

## Smart Card entry (second part of the request)

The Smart Card page currently sends a visitor without an account to `/auth?next=…`. That is the confirmed cause of the login redirect. Changes:

- **Start Challenge** opens the isolated student board for that card directly, with no sign-up and no sign-in.
- The visitor sees only that card's question — no dashboards, no other cards, no assignments.
- **Back** returns to the exact Smart Card that was opened.
- Marking runs through the existing marking logic; AI usage stays attributed to the card's owner, never to the anonymous visitor.
- **Share Smart Card** is removed. **Copy Smart Card** copies only the public URL (`/smart-card/<id>` on the current MathGPL domain) and confirms with "Link copied".

Anonymous solving needs a public read path for the card's question plus an unauthenticated marking route. Any new database permission for that is staged as an additive migration and takes effect when this draft is accepted, so the anonymous flow can only be exercised after acceptance.
