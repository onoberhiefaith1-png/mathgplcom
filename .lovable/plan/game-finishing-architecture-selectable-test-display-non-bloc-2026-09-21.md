# Game finishing architecture: selectable test display, non-blocking rewards, line-safe notes, and no overlap

Goal: keep the now-responsive Game intact, preserve both existing test/text render approaches, and make the Game feel like one Smartboard split into line-by-line writing surfaces.

## Confirmed from the current code

- The Game Play screen already uses one shared mathematical state from Floating Numbers and mirrors it onto the 3D Game Slate (`GamePlayPage`).
- The current text path has multiple visual renderers: `WritingRegion` chooses `TileText` or `DimensionalText`, and there is also a plain surface fallback (`PlainText`). There is not yet a named teacher-facing “Surface Test / 3D Test” display setting.
- Notes are currently shown only when `runtime.completedLines` contains that exact line.
- Rewards are currently triggered from consumed reward keys and visual effects are dispatched to the Slate world, but reward animation state still lives inside the same Slate column render path.
- Surface layout is built from per-line measured text height, but the next pass must make height changes explicitly push later surfaces down and preserve gaps.
- The uploaded screenshot shows visible text outside/above the intended panel area, so the visual renderer choice and surface box must be controlled together.

## Build

### 1. Keep both test visual systems and add one selector

Add a saved Game setting called `testDisplay` with two choices:

- `surface` = Surface Test: text rendered on/inside the physical writing surface.
- `threeD` = 3D Test: raised/external 3D-looking text.

Add the selector in the Game settings panel as “Test display”.

Rules:

- Do not delete either renderer.
- Do not create a third test engine.
- Do not duplicate the question, line state, score, completion, timer, notes, or rewards.
- Both renderers read the same `slot.text`, same selected line, and same teacher text settings.
- Only the selected renderer is visible and interactive.
- The inactive renderer remains available in code but has no visual output and no pointer interaction.
- Keep the currently working fast click/type path as the default behavior for existing Games unless a saved setting says otherwise.

### 2. Make reward effects a separate non-blocking overlay

Keep `useGameRuntime` as the source of truth for completion, lives, timer, Vaults, and consumed rewards.

Change the reward visual path so a reward event is “fire and continue”:

- line completion updates state immediately;
- typing and line switching continue immediately;
- timers continue from the shared Game clock;
- reward animation starts in the overlay but is never awaited by the Game;
- missing or slow reward art never blocks text, line state, scoring, or timer updates;
- reward animation completion only removes/hides that visual effect, not game progress.

Implement this with a small event queue/overlay boundary around the existing reward effect code, not a full rewrite.

### 3. Lock reward activation to real line completion

Keep Vault behavior unchanged: exact consecutive code matching can open a Vault independently.

For every other reward:

- do not activate on line selection;
- do not activate on scrolling;
- do not activate when the student leaves a line;
- do not activate from a tap on the reward;
- activate only when the marking result awards that exact line.

Use the existing `lastAwardedLineId` / completed-line signal as the only completion source for line rewards and the completion coin.

### 4. Keep notes behind the exact line mark

Each note belongs to one line.

- A note stays hidden while the line is incomplete, incorrect, stale, or only partially written.
- Moving to another line never reveals the previous line’s note.
- A note becomes visible only after that exact line is marked correct/equivalent and earns its mark.
- Reset hides all notes again for the run without deleting teacher-authored notes.

### 5. Preserve vertical spacing when surfaces grow

Make each writing surface keep its own content-driven height, then flow the following surfaces after it:

```text
Surface 1 height changes
  -> keep the configured gap
  -> move Surface 2 down
  -> keep the configured gap
  -> move Surface 3 down
```

Rules:

- no overlap;
- no shared height for all surfaces;
- Surface 0 remains the read-only question;
- Line 1+ surfaces correspond one-to-one with Floating Numbers lines;
- surfaces remain inside the 5%–95% safe writing band, or inside the pillar-safe band when a room blocks the sides;
- teacher text size, colour, style, depth, opacity, alignment, spacing, and animation are preserved.

## Technical notes

- Extend `GameSettings` and saved-game normalization with `testDisplay?: "surface" | "threeD"`.
- Add the selector to `ControlPanel` near the current text appearance controls.
- Gate `WritingRegion` so it can render either the surface-attached text path or the raised 3D path from the same props/state.
- Keep the inactive renderer out of pointer hit-testing and avoid continuous expensive rendering for it.
- Keep `GamePlayPage` state as the single source for line text, completion, notes, and reward event dispatch.
- If reward visuals still share too much work with surface rendering, extract a lightweight `RewardOverlay` component fed by event objects from the runtime/Slate bridge.
- Strengthen `buildLayout`/`SlateColumn` so measured height changes recalculate each following region’s top/centre from the previous region plus the configured gap.

## Verification before completion

Test the current Game on desktop and phone:

1. Surface 0 shows the full question.
2. Line 1 starts from the correct safe left edge and grows rightward to the safe right edge.
3. Pillars do not cover text or the writing surface.
4. Rapid Floating Numbers taps appear immediately in the selected matching line.
5. Switching Surface Test / 3D Test changes only the visual display, not the math state.
6. The inactive display style does not show, receive clicks, or slow the active style.
7. Leaving a half-written line does not award marks, rewards, completion coins, or notes.
8. A correct/equivalent line awards once and then reveals only that line’s note.
9. Vaults still open only from exact consecutive code matching.
10. Bombs, Life, and Collectors animate without pausing typing, line changes, scoring, or timers.
11. If Surface 1 grows taller, Surface 2 moves down and the original gap remains; repeat for later surfaces.
12. Reset clears the run and restores rewards/notes/working without changing the teacher’s saved Game design.
13. No `v is not defined`, blank text, off-screen text, duplicated visible test, frozen timer, or blocked input remains.

## Not changing

- No Game rebuild.
- No replacement math engine.
- No removal of either existing test/text renderer.
- No change to working Vault matching behavior.
- No unrelated security, assignment, Adventure, or lesson-note changes.
