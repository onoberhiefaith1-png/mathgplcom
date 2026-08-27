## Technical notes

**Layout** — `ThreeViewFrame.tsx` currently renders the view switcher as
`fixed left-1/2 top-2`, which lands on top of the board's own assessment strip
(`absolute left-1/2 top-3` in `PresentationView.tsx`). The switcher moves into a
second row below that strip: one top-centre column container holding row 1
(existing strip, untouched) and row 2 (the switcher), with `gap`, `flex-col`,
`items-center` and `max-w-[94vw]`, no negative offsets. When the board renders
no strip (non-assessment boards) the switcher simply becomes the first row.
Board content gains matching top padding so nothing is covered.

**One audio/video state** — the single `<video>` in `QuestionVideoPane.tsx` stays
mounted (already true: the pane is hidden with CSS, not unmounted). Add
`volume` + `muted` state in the pane, persisted to `localStorage`
(`smartboard:videoVolume`, `smartboard:videoMuted`) and applied to the element on
change and on `loadedmetadata`. Add a compact speaker button plus a range input
in the existing control bar. Autoplay rejection from `el.play()` is caught: retry
once with `muted = true`, flag `needsSound`, and clear the flag on the first
pointer/keydown anywhere in the frame by unmuting.

**Segment activation** — `sectionsFor`, `sectionForLine`, `nextSection`,
`prevSection` and `markersFor` in `src/lib/courses/questionVideo.ts` stay as they
are. `shouldAutoPlay({ lineCompleted })` already encodes the mark rule; the
`lineCompleted` input comes from `PresentationView`'s `onLineContext`, whose
`completed` flag is `` `${questionId}:${lineId}` in solvedSlots `` — the awarded
mark, not a visit. Extend `LineContext` with `lastAwardedLineId` so the
Conclusion fires on the marking event for the final line instead of on the
current effect's index/completed combination, and gate it with a
`conclusionPlayedRef` so it plays once per session.

**Introduction** — the intro currently only runs as a chained pre-roll of line 1
when line 1 is the cursor. Change to: on first mount, if `introEnabled`, activate
`INTRO_KEY` and play; drop the chaining, so any line activation replaces it
directly (`goTo` already pauses/seeks the shared element, which guarantees a
single audio source).

**Manual navigation** — Previous/Next keep calling `goTo(..., false)`; they never
consult marks. "Back to my line" is unchanged.

**Fallback** — when `courseMediaUrl` resolves to null or the element fires
`error`, render a short in-player message instead of the spinner; the board is
unaffected.

**Verification** — unit tests for the activation matrix (intro-on-open,
mark-aware autoplay, conclusion-on-award, manual navigation independence) in
`src/lib/courses/__tests__/`, plus a Playwright pass over the student board at a
narrow and a wide viewport confirming the two control rows never intersect and
the volume/mute state survives view switches.
