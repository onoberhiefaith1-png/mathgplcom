# Make the Game work properly on a phone

## What I actually found (measured on your saved Game, at your phone size 428 x 679)

**Game board (editing)**
- The top row of controls does not fit the screen. Measured on a 428px-wide phone: the buttons run to 452px, so **Edit is cut off the right edge** and the sound button sits on top of "← Games". That is why you could not add or change anything — the controls were literally off-screen.
- When the settings panel does open, it covers **86% of the screen**, so you cannot see the surface you are styling, and the top controls sit underneath it, unreachable.
- The panel's last section is cut off behind the Save bar, so the lower settings (including writing surface / text style) are hard or impossible to reach.

**Game play (students)**
- The score row (Time, Life, Vault, Completion, marks, Reset) is laid out for a wide screen. On a phone it wraps into a block taking **about 45% of the screen height**, with labels colliding ("VAULTCOMPLETION").
- The writing surfaces start underneath that block, and the Floating Numbers keys at the bottom are partly pushed off the screen.
- Result: almost no room left to read the question, see your working, or reach the number keys.

Your saved Game data is fine — this is purely the phone layout.

## The fix

### 1. One phone layout for the Game board (editing)
- Replace the overflowing top row with a compact phone bar: back, game name, and a single menu button holding View / Questions / Save / Play / Edit / sound. Nothing may ever sit off-screen.
- The settings panel becomes a proper bottom sheet on phones: it opens over the lower part of the screen, can be dragged taller or shorter, and always leaves the board visible above it so you can see each change as you make it.
- The sheet scrolls to its very end with the Save button pinned and no section hidden behind it, so writing surface and text style are always reachable.
- Tablet and desktop layouts stay exactly as they are today.

### 2. One phone layout for Game play (students)
- Turn the score row into a single compact strip: time, lives, vault, completion, marks as small icons and numbers on one line, with Reset and Exit in a small menu. Target height on a phone: one short row, not a block.
- Give the board the space that frees up, and keep the Floating Numbers keys fully on screen, above the phone's own bottom bar (safe-area aware).
- Keep the order the student needs: question and current line visible, working visible, keys reachable with a thumb.

### 3. Touch behaviour
- Make the board scroll by dragging (vertical swipe moves the slate through the lines) and make tapping a surface select that line, exactly as clicking does on a computer — with the tap not being swallowed by the drag.
- Keep the phone's own keyboard suppressed on the board, as the rest of the Smartboard already does.

### 4. Verify on a real phone-sized screen
Checks I will run at 428 x 679 and 390 x 844, and report with screenshots:
1. Every board control is reachable; nothing off-screen.
2. Opening settings still shows the board; choosing a writing surface and a text style visibly changes the board straight away.
3. The panel scrolls to the last setting; Save works.
4. In Play, the score strip is one row, the surfaces are visible, and the number keys are fully on screen.
5. Swiping moves through lines; tapping surface 3 activates line 3 and stays there.
6. No new errors in the browser console.

## Not changing
The Game's look, the 3D surfaces, materials, rewards, Vault, timers, the mathematics, Floating Numbers behaviour, saved teacher designs, or the desktop and tablet layouts.

## Technical notes
- `src/pages/game/GameSlateEditorPage.tsx`: header becomes responsive (phone = compact bar + overflow menu); `ControlPanel`/`QuestionsPanel` wrappers switch from `fixed inset-y-0 right-0 w-[86vw]` to a bottom-sheet container on `phone` via `useBreakpoint()`; keep `md:` static column untouched.
- `src/components/slate/ControlPanel.tsx`: scroll container gets bottom padding for the pinned Save bar plus `env(safe-area-inset-bottom)`.
- `src/pages/game/GamePlayPage.tsx`: HUD split into a phone strip (icons + numbers, Exit/Reset in a menu) and the existing desktop row; Floating Numbers dock gets safe-area padding.
- `src/components/gameslate/world/SlateColumn.tsx`: confirm touch drag maps to the existing `scroll` offset and that a tap under the drag threshold still fires `onSelect` (no change to `setActiveLine` ownership).
- Verification via authenticated Playwright at mobile viewports; note that this sandbox uses software rendering, so timing numbers are indicative only — layout findings are exact.
