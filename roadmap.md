# Roadmap — Game polish (plan 2026-09-26)

## Imagine — lightweight 2D game
- [x] Repair editor text-size preview and proportional surface contraction; protect newer edits during saving; verify increase/decrease and device independence in the signed-in editor
- [x] Replace Game II naming and routes with Imagine
- [x] Keep the original 3D Game unchanged
- [x] Add Imagine library, independent 2D editor, player, and student navigation
- [x] Separate background, writing, Floating Numbers controls, and bounded reward animation
- [x] Add content-growing premium flat surfaces, writing treatments, live sensor, music/reward sounds, and responsive text controls
- [x] Add Imagine-only Energy Ball and Calculator Trophy rewards with separate non-blocking activations
- [x] Mobile Imagine margin reclaims real writing width; labels contract to the 5% minimum and surfaces grow independently
- [x] Imagine saves independent desktop, tablet, and mobile text sizes; below the old minimum, each visible surface contracts with its text
- [x] Math Core and Premium Chain Bomb share lightweight horizontal-orbit lightning chains; Hourglass, Vault, and Completion stay protected
- [x] Imagine bombs stay round and activate in place; Horizontal and Vertical Collectors make contact-ordered full-axis sweeps
- [x] Imagine Energy Ball projectiles activate every eligible reward (Vault included); only Hourglass and Completion stay protected
- [x] Replace both legacy Imagine bombs with the Energy Ball and use angled Collector projectiles for every visible eligible reward
- [x] Restore the Energy Ball’s original round artwork, size and movement; remove the upgraded centre-screen launch
- [ ] Verify authenticated teacher creation/editing and assigned student play on phone and desktop

- [x] Phase 1: Predictive Line: set-aware and side-swap equivalence, red Completion Token, pre-evaluated instant confirmation
- [ ] Phase 2: each written line restores to its own surface (needs per-line save records)
- [ ] Phase 3: Hourglass always visible. Lead: the line timer's hourglass is counted by evaluation but only drawn if a placed hourglass reward exists
- [ ] Phase 4: Level Map (cards, upload/AI picture, lock states, LEVEL COMPLETE transition)
- [ ] Phase 5: Sensor visible before first stroke; no scene rebuild on scroll
- [ ] Phase 6: reward updates off the writing path
## Game fidelity and Academia teaching upgrade
- [x] Restore Game visual/audio fidelity in every play path
- [x] Let writing margin reach surface edge and keep numbers visible
- [x] Repair Vault ordered-expression activation
- [x] Add teacher Session Assign, Lesson Note, and Smartboard actions
- [x] Add isolated single-Session guest completion links
- [x] Add separate Practice and Play line-mapped videos
- [x] Verify type safety, Game regressions, and public/session route rendering
- [ ] Verify authenticated desktop/mobile interactions (preview session could not be restored in browser)

## Game & Practice pass (this round)
- [x] Instant marking on assigned work, shared links, Academia Practice and Play (look-ahead runs from the first Floating Number placed)
- [x] Brown = marks awarded, blue = current attempt, everywhere the assignment board opens
- [x] Exit Game always leaves, even when the Game was opened from a link
- [x] Game menu Text control is now a text-size slider (left smaller, right bigger)
- [x] Phone: Floating Numbers sit above the browser's bottom bar; that strip stays empty
- [x] Phone and tablet: surface scroll rail invisible (scrolling still works); desktop unchanged
- [x] Practice never shows a "completed — undo to retry" notice
- [x] No "time ran out — one life used" message in the Game
- [ ] Verify authenticated desktop/mobile interactions in the preview

## Instant marking + writing surface (this round)
- [x] Equations always fit inside the writing surface (width and height containment)
- [x] Answers pre-cleared for every line before writing starts, so assigned work, shared links and Academia Practice/Play mark on the finishing keystroke
- [ ] Confirm instant marks and score on a real assigned game / shared link / Academia Play

## Staff Hub
- [x] Foundation: Staff Hub in School nav, School Tasks in teacher nav, Admin/Manager/Staff
- [x] Tasks: assign to one/many, deadlines, proof + files, review, extensions, comments, live updates, templates
- [x] Availability, Projects, Goals, workload warning
- [x] Reports (per-teacher, per period, export/print), audit trail, links to MathGPL work
- [ ] Automatic MathGPL work evidence on linked items + Staff Hub AI (separate plan)

## Academia single-question + Staff Hub completion
- [x] Academia Play shows only the card's question (no Levels)
- [x] Each question sent is its own "Question N" card, AI-designed or teacher picture
- [x] Staff Hub polish: status board, sticky tabs, overdue logging, MathGPL evidence
- [x] AI task review + AI teacher/team reports with print
- [ ] Signed-in end-to-end check as school + teacher (needs a real school/teacher session)

## Calculation Subcells
- [x] Lesson Note: Add / Edit / Remove Subcell, blue divider, answer kept separate
- [x] Generation page: Row | Column | Subcell mode, per-subcell Floating Numbers
- [x] Student board: active Calculation Workspace + Calculate drops result into the answer
- [x] Copilot writes subcells for derived columns (verify-or-drop)
- [x] Advance show/hide toggle (Lesson Note + Smartboard), phone sideways swipe
- [ ] Academia refinements from 3rd document (separate plan)
- [ ] Verify Subcells/Calculate in a signed-in browser session

## Game table writing surface
- [x] Default table fills the complete physical writing-surface width
- [x] Bottom minus/plus controls resize the table and its surface together within safe limits
- [x] Preserve the shared Smartboard table renderer, Subcells, rewards, Vaults and Calculate
- [x] Match the Lesson Note's saved column proportions, cell spacing, borders and text size in the Game
- [x] Make table actions bold and readable; resize the table and physical surface together
- [ ] Verify the active table visually in a fresh phone Game attempt (signed-in preview remained at 10% loading without runtime errors)
- [x] End the normal physical surface at the rendered table and replace normal resize controls with focus
- [x] Add a Game-covering table focus view with resize controls available only while expanded
- [ ] Verify focus/collapse and table-height measurement in a signed-in desktop and phone Game
- [x] Enlarge the selected physical writing surface as the focus background with matching ink
- [x] Move Table Size after Advance and dock Floating Numbers at the bottom of table focus
- [ ] Verify focused surface contrast and Floating Numbers insertion on dark/light surfaces
- [x] Keep Game table headings and Subcell calculations on one line; align each row's blue dividers and remove completed ticks
- [ ] Verify synchronized Subcell row growth with multiline working in a signed-in Game
