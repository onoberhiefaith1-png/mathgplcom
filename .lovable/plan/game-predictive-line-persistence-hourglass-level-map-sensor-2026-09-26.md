# Game: Predictive Line, persistence, Hourglass, Level Map, Sensor

The working Game is the baseline. We don't rebuild anything, add a new 3D engine or undo the speed fixes. Reward conversion maths (Hourglass→Time, Life→Time, Vote→Life, Coin→Life, all multipliers) **stays exactly as it is**. Prediction and marking keep their current running cost of nothing: no new paid AI and nothing sent out per keystroke.

The work comes in six phases, in your priority order. Each phase ends with the Game checks passing before the next one starts.

## Phase 1: Predictive Line with a Completion Token (highest priority)
- Rebuild the reasoning inside the existing shared engine. It will work on the structure of the maths, not on the characters typed. It compares the expected line, what the student has written, and the Floating Numbers left for that line.
- Rearranged lines count as correct. For example, `{1,2,3} = A` matches `A = {1,2,3}`, including sets, where order doesn't matter. Lines that follow from each other, like `3x/3 = 15/3` and `x = 5`, are judged by the maths, not the spelling.
- **Completion Token.** This is the last piece that would finish the student's current correct route. It could be a number, letter, operator, bracket or symbol. It shows in **red** on the Predictive Line and updates with every change the student makes.
- **Pre-evaluation.** The result is worked out before the last piece arrives. When the student places the Completion Token, the line is confirmed, marked and rewarded on that same press, with no second calculation.
- **A different piece.** The engine first looks for another correct route and shows a new token. Only if none exists does it say INCOMPLETE, INVALID or NO VALID ROUTE. "NO VALID ROUTE" never appears just because the layout is different.
- Fixed states are EQUIVALENT, NOT_EQUIVALENT, INCOMPLETE, INVALID and PENDING. The local result always wins, so an answer never flips back and forth.

## Phase 2: Each line stays on its own writing surface
- First, reproduce the problem: write lines 1 to 4, leave, come back. Then find where the lines get merged onto one surface. I haven't confirmed the cause yet. The saved progress record keeps only the current line number, not each line's writing.
- Save each line with its line number, surface, content, state and time, and put each one back on its own surface. Timers and lives keep following today's rules.

## Phase 3: Hourglass always shows
- Find why a line that has an Hourglass in its data doesn't draw one, and fix how the picture and the data stay in step. Time maths isn't touched.

## Phase 4: Level Map
- A new Level Map page shows the levels of a Class + Game as cards in rows and columns. Each card has a number or name, a picture, and a state: complete, current, unlocked or locked. It shows progress where it applies.
- Teachers can upload a card picture or use AI Generate (optional). An empty placeholder shows until one is chosen. The card picture is separate from the Game background.
- Opening a level always starts at line 0 of that level.
- Finishing a level shows a smooth "LEVEL COMPLETE" moment, then goes back to the map with the next level unlocked. It uses the existing unlock rules.

## Phase 5: Sensor always on, and smoother scrolling
- The Sensor shows on the active surface as soon as the Game opens or a surface is chosen, before any writing. It stays on while writing, pausing and scrolling, and follows the current line.
- Scrolling stops rebuilding the scene. Existing objects are reused, and surfaces or text are only rebuilt when their content actually changes. Visual quality stays the same.

## Phase 6: Rewards never freeze play
- Reward and economy updates and their animations run separately from writing. Only the timing changes; the conversion rules stay the same.

## Final report
It will cover each of the 10 points you listed, with the checks that passed and any issues left.

## Technical details
- Engine: `src/lib/predictive/predictiveLine.ts` gains a structured representation (sides of an equation are interchangeable, set members are unordered, terms that can be reordered are normalised). It keeps the existing search over Floating Numbers and returns `completionToken` plus a cached `preEvaluated` verdict for each route. `instantAward.ts` and `preClear.ts` use that cached verdict. Floating Numbers renders the token in red using a design colour token. Server marking (grade-line) stays the authority in the background; it gets no new AI calls.
- Persistence: add per-line records (line key, surface id, content, state, updated_at) to the saved Game progress, in a migration with grants and access rules. `useGameRuntime.ts` restores each line by its surface id.
- Hourglass: follow the line's hourglass data from `lineSurfaces.ts` / `useGameRuntime.ts` to where `SlateColumn.tsx` draws it.
- Levels: store the card picture on each level entry (`slate_game_questions`), using file storage for uploads. AI images come from the existing image generation. A new route shows the map, and completion navigates to it.
- Tests: new engine tests (rearranged lines, sets, route change, token match, no false NO VALID ROUTE), a save/restore test, and hourglass/sensor visibility checks. Also run the existing Game suite and do a run-through in the browser.
