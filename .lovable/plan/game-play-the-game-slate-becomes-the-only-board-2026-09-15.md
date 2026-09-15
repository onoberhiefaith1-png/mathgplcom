# Game Play — the Game Slate becomes the only board

Right now Game Play puts the whole Smartboard page in front of the Game world, so it feels like a Smartboard with a game behind it. This rebuilds the screen the correct way round: the Game Slate is the board, and only the small student/mobile Floating Numbers control strip sits at the front/bottom.

Nothing in the Game Slate world is redesigned, and no second mathematics engine is created. The existing marking, marks, notes and timers keep working exactly as they do today.

## What the player sees

```text
┌─────────────────────────────────────────────┐
│ BACK  L0 L1 L2 L3 …   TIME  SCORE %  🪙 ❤️ ⟳ │
├─────────────────────────────────────────────┤
│                                             │
│            THE GAME WORLD (3D)              │
│   Line 0  — the Question (read only)        │
│   Line 1  — the student's working           │
│   Line 2  — the student's working           │
│            rewards on each line             │
│                                             │
├─────────────────────────────────────────────┤
│   FLOATING NUMBERS CONTROL PANEL (mobile)   │
└─────────────────────────────────────────────┘
```

No white page, no Smartboard document surface, no Smartboard sensor pad, no View / Save / Edit controls.

## How it behaves

1. **Line 0** holds the complete Question, read-only, with no reward and no pattern position. Solving starts at Line 1.
2. **The panel drives one line at a time.** Whatever the student builds on the active line appears live on that physical Game Line as they work.
3. **Two-way line selection.** Tapping a Game Line switches the panel to that line; the panel's own Back / L4 / Forward controls move the active Game Line. Always one shared line state — never two copies of the mathematics.
4. **Line completion.** The line is checked by the existing engine; when correct the mark is awarded, the configured Note appears under that line, that line's rewards resolve, and the next line becomes active.
5. **Rewards.** Coins fly into the balance, a Life is added, a Line-timer hourglass adds its bonus to the Question countdown when the line is finished in time and simply dissolves when it isn't. A spent reward can never be collected twice.
6. **Timers.** The Question countdown comes from the teacher's Floating Numbers setting. A line timer starts on the student's first real input on that line, not on arrival.
7. **Lives.** Question time out with a life: one life is spent and the Question restarts. With no lives: Game returns to Question 1; completed marks already recorded stay recorded.
8. **Score and percentage** come only from the real Floating Numbers marks (achieved ÷ total × 100).
9. **Reset** clears the current working only — never coins, lives, completed questions or Game progress.
10. **Clean start.** Entering a Question clears leftover test/previous working; only the teacher's configured Question, lines, rewards, timers and settings carry in.
11. **Questions run continuously** — 1, 2, 3 … then a Game Complete summary. Progress, coins, lives, marks and spent rewards restore on return.
12. **Teacher Play** from the Game Board opens this same runtime, recording nothing. Students reach it only from Class → assigned Game → Play.
13. **Keyboard** stays available on laptop/desktop; on phones the device keyboard stays suppressed exactly as it is today.

## Technical section

- `src/pages/game/GamePlayPage.tsx` is rebuilt: `WorldStage` fills the screen as the only board, a Game HUD row sits above it, and a fixed bottom dock holds the Floating Numbers panel. The "Focus board" toggle and the translucent board overlay are removed.
- `PresentationView` gains a `chrome="game"` mode that renders **only** the mobile student Floating Numbers panel and its own line strip — no board canvas, no page background, no `SensorDPad`, no assessment control panel, no fullscreen/settings chrome. `mobileStudent` behaviour is forced on in this mode regardless of breakpoint, so the compact controls, typography, sizing (+/−) and input rules are the existing ones. Every other gateway (guest, class, assessment, teacher, present) is untouched.
- Line ownership: `PresentationView` reports its active line through the existing `onLineContext`, and accepts a new controlled `activeLine` prop so the Game can set it. `useGameRuntime` holds `currentLine` as the single source of truth and syncs both directions; sensor-driven line changes are ignored in game chrome.
- Live working on the slate: `PresentationView` reports the active line's rendered text through a new `onLineText` callback; `GamePlayPage` writes it into that line's `Slot.text` in the derived `displayGame`, so `SlateColumn`/`text3d` renders it with no change to the world code. Completed lines keep their text; a configured Note is appended to the slot text only after the mark is awarded.
- Game Line clicks: `WorldStage` is mounted with a slot-select handler that maps `slot.id` (`line-N`) to `runtime.setCurrentLine(N)`; `mode` stays `"view"` and no editing handler is wired.
- `useGameRuntime` keeps its existing question/line progression, reward consumption, coin/life state, timer handling, persistence to `slate_game_progress` and result writing; it gains explicit `setCurrentLine`, note reveal per line, and per-question working reset on entry.
- Tests: two-way line sync, Line 0 excluded from rewards and marks, live text mapped to the right slot, note revealed only after mark, reward consumed once, line-timer start-on-first-input and expiry, score/percentage, progress restore. Existing Slate and Smartboard suites plus typecheck must stay green.

## Step 2 (after this works)

Spending coins: a teacher-set Economy section on the Game Board (price per life, bomb, left collector, right collector, and per block of extra time), the coin shop in the Game HUD, Bomb clearing only rewards currently inside the visible viewport (timers exempt), and the Collectors driven by their existing world behaviour.
