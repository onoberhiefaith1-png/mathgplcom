# Canvas slides: Next button, fixed zoom control, visible in the lesson note

Three problems to fix on the projected Canvas, in both the lesson note and the Smartboard.

**1. The Next arrow disappears.** Back works, forward is missing. The arrows and the zoom badge currently sit inside the same strip that grows when you zoom, so as soon as the picture gets bigger the right-hand arrow is pushed outside the page and off screen.

**2. The zoom badge moves and then vanishes.** At 100% and 120% it is reachable; by 200% it has travelled off the edge. It should stay in one fixed place, always in reach while you keep increasing, and only fade after 10 seconds of no activity.

**3. The Canvas shows blank in the lesson note** but the same slides appear correctly on the Smartboard. The frame is there, the pictures are not.

The fix: the arrows, the slide counter and the zoom badge stop being part of the growing picture and become a fixed control layer pinned to the note's own width. The picture grows underneath them and pushes the text below it downward, exactly as now. Then I find and fix the reason the note shows an empty frame.
