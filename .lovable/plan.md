# Adventure Continue/Restart + MCQ page scrolling

## 1. Academia Adventure: Continue or Start again
- While a student plays, save where they are (video position, current learning point, points already passed) on their device and with their attempt, every few seconds and on leaving.
- When they come back, the start screen shows two buttons:
  - **Continue** – the video resumes from the exact spot they left, with passed learning points kept and the music/narrator picking up at that point (no replay from the beginning).
  - **Start again** – clears that progress and plays from the beginning.
- First visit (nothing saved) shows only **Start Adventure**.
- Unlimited attempts, like the Game: a finished Adventure can be started again any number of times; each finished attempt is recorded once in results (never counted twice).
- Standalone Adventure and the normal Game stay unchanged.

## 2. Multiple choice: reach the question, options and Next while the mini board is open
- The mini board keeps its own left/right and up/down movement.
- Add a slim page bar on the right edge of the mini board (where you circled) with **Up** / **Down** buttons that scroll the whole page, so the question above and options A–D below are always reachable even when a finger or mouse is over the board.
- Lower the board's starting height so at least the first options show under it on a phone/laptop; it can still be stretched taller.
- Scrolling with the mouse wheel or a finger outside the drawing area moves the page instead of being swallowed by the board.
- A small floating **Next question** button stays visible while the board is open.
- Applies to both the Subject exam page and the Session multiple-choice card.

## Technical details
- `AcademiaAdventurePlayer.tsx`: persist `{t, pointIndex, passed}` under the existing per-activity storage key; on load offer Continue (seek video `currentTime`, restore slot state, narration engine reset to `t`) or Restart (clear key). Completion writes results once per attempt id.
- `McqSolutionBoard.tsx`: wrapper gets a right-side rail (`scrollBy` on the page scroller via `closest` scrollable/window), initial height `min(50vh, 420px)`, `overscroll-behavior` so page scroll chains; `McqExamPage`/`SessionMcqPage` add sticky Next button.
- Unverified signed-in; owner to test on phone.
