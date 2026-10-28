## Game Flow designer
Add **Flow** to Game settings. It opens a Game-specific designer showing the real completion page over the Game’s current background.

- Upload one or more character clips, reuse the existing alpha/checker removal and keep/remove refinement tools, then drag and resize the cut-out character directly on the preview.
- Provide five clearly labelled timeline rows. Each row selects its own start and end frame, can be previewed independently, and shows whether it is ready.
- Remove Tray, Trail, Base, Float In/Out and Smartboard controls from this designer.
- Preview the three-star sequence, reward count bar, Complete/Failed copy and action buttons with sample values.
- Save the media paths, five ranges, volume and placement inside the Game’s existing settings so copied/shared Game payloads preserve one immutable design. Smartboard Flow records and lesson-note behavior are not modified.

## Runtime and reward accounting
The current Game runtime advances to the next question as soon as its final line completes. Replace that automatic transition with an explicit result state.

- Record a per-question reward ledger from the same authoritative events that already award marks, completion coins, Vaults, time and lives; do not infer rewards from animation.
- Freeze that ledger when the final line is awarded, persist the completed question, unlock the next question, but leave the current question visible behind the completion scene.
- Continue performs the existing question transition and resets only question-local presentation state. Repeated taps, reloads and restored progress cannot pay rewards twice.
- Failure opens the Time Up scene. Exit asks for confirmation and, when confirmed mid-question, plays Left Early before returning.
- Define pure outcome selection and reward-summary helpers with focused tests for ordinary completion, perfect run, final victory, failure, early exit and idempotent Continue.

## Academia sequence
- Build one ordered Session runner shared by activity cards: it knows the current activity, next eligible activity and whether the Session is finished.
- Signed-in Play, guest Play and offline Play pass the attached Game’s completion configuration through their existing payloads. Continue switches to the next ordered activity rather than exposing Game level selection.
- Practice completion uses the same sequence controller but renders the restrained Practice result. It saves the attempt before enabling Continue.
- Extend the offline package with only the completion media/configuration each activity needs, cache uploaded character clips with the existing offline media path, and retain deterministic on-device evaluation with no AI calls.
- If the next activity has no Game, Play Continue returns to its activity card instead of silently skipping it. Practice can continue whenever the next activity has an assessment question.

## Visual direction
The completion page should feel like a premium arcade tally screen, not a generic modal: full-screen Game background, centered three-star crown, large status, a horizontal/counting reward ledger, and the character staged beside rather than over the numbers. Phone layout stacks character, stars, ledger and action safely above device controls. Reduced-motion mode shows the final state immediately.

Practice uses the same clarity without spectacle: quiet surface, strong score, line summary and one obvious Continue action.

## Verification
- Complete each non-final and final Game question; confirm no transition happens before Continue and no reward is duplicated.
- Exercise all five character outcomes, missing-character fallback, mute, reduced motion, reload during the result and phone/desktop sizing.
- Run an Academia Session containing two different Games and confirm each Play result uses its own background and character.
- Repeat through a guest Session and the installed app offline; confirm uploaded Flow media works offline and streaming-video rules are unchanged.
- Complete two Practice activities and confirm the calm results, saved scores, explicit Continue and final return to the Session.
