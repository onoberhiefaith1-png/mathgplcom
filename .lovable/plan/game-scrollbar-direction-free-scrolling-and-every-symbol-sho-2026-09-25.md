# Game: scrollbar direction, free scrolling, and every symbol showing

## 1. Right-side scrollbar moves the same way you do
Right now the bar is flipped: dragging it down moves the board up. The slider is set to run "reversed". Fix it so:
- Drag the handle down -> the board moves down (towards line 3, 4...).
- Drag up -> towards the Question.
- The handle's position always matches where you are, and the Q / 1 / 2 / 3 markers stay in the right order top to bottom.

## 2. Scroll up and down at any time, like a smartboard
The board should scroll with the mouse wheel / trackpad / finger drag wherever the pointer is, including over the writing surfaces, without having to click a surface first.
- Wheel and trackpad scroll everywhere on the board, including over written text, the question, and the number tiles area above the board.
- Finger/mouse drag on a writing surface scrolls the board if you are not actually writing; tapping still selects the line.
- A "stuck" scroll lock (left on after touching a reward) is always released, so scrolling never freezes.
- Scroll speed smoothed so one trackpad flick doesn't jump several surfaces.

## 3. Every symbol appears on the writing page (curly brackets included)
Clicking `{` or `}` (and any other symbol) in the Floating Numbers tray must put that exact symbol on the writing page, the Smartboard, the evaluation panel, and everywhere else.
- In your screenshot the tray shows `A = {} 1,2,3` but the writing surface shows `A = 3,4,5` with no brackets. The Game's display step removes every `{` and `}`, treating them as hidden formatting instead of real symbols.
- Fix: real curly brackets are kept and shown; only hidden formatting (for fractions, powers, roots) is removed.
- Same check for all other symbols: sets (∪ ∩ ∈ ∅ ⊂), sums/products (Σ ∏), integrals, arrows, Greek letters, matrices, physics units and chemistry notation. Anything the tray can insert must show up exactly as clicked.
- Checked in the Game writing surface, Game evaluation panel, Smartboard and lesson-note Floating Numbers, so it works the same everywhere.

## 4. Checks
- Automatic tests: `{1,2,3}`, `P ∪ Q = {a, b}`, nested brackets, Σ/∏/∫, matrices, chemistry formulas all display with every symbol intact; fractions/powers still display as before.
- Open the Game: drag the scrollbar down/up and confirm direction; scroll with the wheel over a writing surface without clicking; type `A = {1,2,3}` and confirm the brackets appear on the writing page.

## Technical details
- `src/components/gameslate/world/WorldStage.tsx`: remove the reversed direction on the vertical range input (`[direction:rtl]`) so value grows downward; confirm `moveToRatio`/marker ratios match. Wheel handler: normalize `deltaMode`, keep `passive: false`. Make sure wheel/pointer events from `drei <Html>` overlays (writing text, question, tiles) reach the scroll handler (forward them or attach at the shared container); only skip drag-scroll while actively writing, not the whole `[data-writable]` area. Always clear `scroll.current.locked` on pointerup/cancel/leave.
- `src/components/gameslate/ReadableMath.tsx`: `tidy()` strips every `{}` (`.replace(/[{}]/g, "")`). Replace with removal of LaTeX grouping only (after `^ _ \frac \sqrt` etc.), and turn `\{ \}`, `\lbrace \rbrace` into visible braces; stop dropping unknown `\commands` that are real symbols (map them to Unicode instead). Update `leaksSyntax` so real braces aren't flagged.
- Trace the Game writing-surface path (`src/lib/slate/structuredMath` -> `MathTreeRender`, `WritingRegion`/`PlainText`) and fix any step that treats a tray `{` as a group opener; reuse the shared lossless pass-through from the earlier symbol fix so Game, Smartboard and lesson notes stay identical.
- Add tests next to existing ReadableMath / structuredMath tests.
