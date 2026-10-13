# Game upgrade in four phases

Each phase gets finished and tested before the next one starts. Maths checking, Floating Numbers, scoring and the current gameplay stay as they are.

## Phase 1: Rewards never freeze the game
- Look into what really causes the freeze (reward flights, sounds, chain bombs, collectors, re-drawing the whole board) by measuring long tasks while a reward plays. Don't assume the cause.
- Data flows one way: the game marks a line → the game applies any life or score change straight away → it sends a small reward event → a separate reward layer plays the animation.
- Animations use only lightweight transform and opacity effects. The queue is capped, with a cancel or skip after a timeout. Flights that fail are dropped quietly and never touch game state.
- Tests: one reward, a quick burst, rewards playing while the student types, moves the sensor or submits, a failed animation, and many rewards over a long session.

## Phase 2: Writing size control
- One up/down control next to Evaluate. It changes size in 10% steps from 100% to 200% and stops at both ends.
- The writing area scrolls on its own while the toolbar stays at the bottom. All five surfaces stay reachable, and the selected line scrolls into view.
- Resizing keeps the work, the selected line and the cursor where they are. The setting is saved for each device.

## Phase 3: Sensor moves between lines
- Up and Down move inside the expression first (exponent → base, numerator → denominator). When there is nowhere else to go, they move to the next or previous line.
- They stop at Surface 1 and Surface 5. Tapping a spot with a finger still works.
- Tests cover base and exponent, fractions, empty lines, the first and last lines, larger sizes, and moving while rewards play.

## Phase 4: Same game everywhere
- Find why finger positioning is missing from shared links. Likely causes: a separate player, a different setting, or old cached files.
- Send Game, Academia, the shared Session link and the installed app through one player, so every improvement reaches all of them.
- The installed app picks up a new version when the student presses Update.
