# Student side: make the teaching video work, and make it look professional

Two problems on one screen. The video is unusable on the student's solving screen, and the student journey around it looks unfinished next to the teacher's.

## Why the video is dead

- The solving screen has no fixed-height container. The three-view frame asks for full height and gets none, so in **Video** view the player collapses to almost nothing — a dark screen while the audio keeps playing behind it.
- The Smartboard's own floating chrome (D-pad, floating-number panel) is rendered into the page root, so it survives when the board is switched away. It sits on top of the player and swallows every click — which is why play, pause and scrub do nothing.

Fix:

- Give the solving screen a real viewport-height stage so board and player each get measured height in all three views.
- Anchor the board's floating chrome inside the board's own container, so switching to Video takes it away with the board and leaves the player free.
- Lift the player above any remaining page overlays and dock the view switcher in the screen header instead of floating it over the content.
