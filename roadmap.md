# Roadmap — Game polish (plan 2026-09-26)

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
