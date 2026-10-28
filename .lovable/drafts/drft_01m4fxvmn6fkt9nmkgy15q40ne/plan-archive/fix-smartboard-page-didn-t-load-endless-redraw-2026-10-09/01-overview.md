# Fix: Smartboard page "didn't load" (endless redraw)

## What is wrong
The last fix stopped a diagram re-adding itself when it redraws, but the Smartboard still crashes. The error log shows the loop now comes from the diagram being **removed and added back as a brand-new entry** each time the board redraws. Each time, it gets a fresh internal name, so the "already added" check never matches, the board is told to redraw, and the cycle repeats until the page gives up.

## The fix
- Track each diagram on the board by its own permanent diagram id, not a name that changes every time it appears.
- Count how many copies of a diagram are showing; only tell the board something changed when a diagram genuinely appears for the first time or the last copy disappears.
- Redraws of the same diagram only refresh its saved picture quietly, with no board redraw.
- Delay the "remove" briefly so a diagram that disappears and immediately reappears in the same moment is treated as unchanged.

Nothing about colours, tapping lines or the Properties panel changes.
