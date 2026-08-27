## Technical notes

**New controller hook** `src/lib/courses/useVideoController.ts` — owns the one `<video>` ref and exposes `{ activeKey, playing, playhead, volume, muted, goTo(key, autoplay), toggle, setVolume, setMuted }`. It replaces the ad-hoc refs currently inside `QuestionVideoPane.tsx`. Segment boundary enforcement moves here from the component's `onTimeUpdate`: pause exactly at `activeSegment.end`, no other stopping condition (no duration cap).

**Trigger correctness.** Today the Introduction, line follow and Conclusion each live in a `useEffect` keyed on `lineContext`, so a re-render can re-fire them. Replace with event-shaped triggers:
- intro: one `openedRef` guard on first ready-with-metadata.
- line change: fire only when `lineContext.lineId` actually differs from the last handled id, using `shouldAutoPlay({ lineCompleted })` for the play decision.
- conclusion: extend `LineContext` with `lastAwardedLineId` (from `PresentationView`'s `solvedSlots` write) and fire only when that equals the final line's id, once per session via `conclusionPlayedRef`.

**Present / Floating Numbers.** No new plumbing in the mathematics: `PresentationView` already holds the single `activeLineIdx` cursor that both Present and Floating Numbers drive, and reports it through `onLineContext` (`PresentationView.tsx:3616`). Verify both paths update `activeLineId` and that Present highlights the line a Floating Number activates; fix only the direction that proves out of sync.

**Segments** keep the existing `src/lib/courses/questionVideo.ts` model (`sectionsFor`, `sectionForLine`, `nextSection`, `prevSection`, `markersFor`, `overlapsFor`) — explicit `segments` markers on one file, `checkpoints` as the legacy fallback. No file splitting, no new schema.

**Teacher reset.** `TeacherExerciseQuestionsPage.tsx` remounts the board per question; add a per-entry session key that also resets the pane's `playedRef`/`conclusionPlayedRef` and the `lineCtx` seed, so a returning teacher replays Line 1.

**Layout.** `ThreeViewFrame.tsx` currently pins the switcher with `fixed left-1/2 top-[5.75rem]`, which is a guess against the board's own `absolute left-1/2 top-3` strip in `PresentationView.tsx`. Replace the guess with one top-centre column container holding row 1 (the board strip, untouched) and row 2 (the switcher), `flex-col items-center gap-2 max-w-[94vw]`, no negative offsets, and matching top padding on the board content.

**Audio.** Keep the single `volume`/`muted` state with `localStorage` persistence (`smartboard:videoVolume`, `smartboard:videoMuted`) applied on change and on `loadedmetadata`; keep the muted-retry plus "Tap for sound" affordance for browsers that refuse sound-on autoplay. The volume slider becomes always visible in the control bar rather than hover-revealed.

**Smart Card.** `src/pages/public/SmartCardPage.tsx:192-194` drops the `/auth?next=` fallback and navigates straight to the isolated board; the `Share2` button is deleted; `copyCard` copies only the URL. The board route gets a `from=smart-card:<id>` origin so Back returns to the card. Public read of a published card's question and the anonymous marking call are staged as an additive migration under this draft's migrations folder.

**Verification.** Unit tests for the activation matrix (intro-on-open, interrupt-on-line-activation, stop-at-end, mark-aware replay, manual navigation independence, conclusion-on-award) plus a Playwright pass over the student board: audible playback with a real seek, segment boundary stop, a view switch that preserves the playhead, and the two control rows never intersecting at a narrow and a wide viewport.
