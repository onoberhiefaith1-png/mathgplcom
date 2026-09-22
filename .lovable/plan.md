# Game writing surface: movable sensor + visible placeholders

## Where things stand

The Game already writes through the Smartboard's own mathematics: the same
tokens, the same brackets, the same structures. The Game surface shows a
flattened copy of that line, and the sensor pad currently shows only ◀ and ▶.

What is missing:

1. **No up / down.** The pad's vertical keys are hidden inside the Game, so the
   sensor cannot step into an exponent or a subscript slot at all.
2. **Vertical keys are unsafe as written.** Outside the Game, up/down fall back
   to moving between physical lines when there is no structure to enter. In the
   Game that would jump the student off the line, which must never happen.
3. **Placeholders read poorly.** An empty exponent currently reaches the surface
   as `12^(□)` — the box is there but buried in brackets, and nothing is raised,
   so it does not look like the exponent cell it is.

## What you will get

- A four-key sensor control on the writing surface: ← → always live, ↑ ↓ live
  only when the sensor is somewhere with a real vertical destination, and dimmed
  otherwise.
- ← → walk the sensor through every insertion position of the current line,
  including inside brackets: `2 | (S + 3)` → `2( | S + 3)` → `2(S | + 3)` → …
- ↑ steps into an exponent cell, ↓ into a subscript cell, and the opposite key
  steps back to the baseline. They only move the sensor — they never add a
  number, a symbol or a new structure.
- The keys never change line, question, level or surface. Game Lines keep owning
  that.
- Placeholder cells are visible on the surface and raised where they belong:
  `12²`, `12` with an empty exponent shows the raised empty cell right after the
  12, `x` with an empty subscript shows a lowered cell. The cell always travels
  with the number it belongs to, because it is read from the same structure each
  time it is drawn.
- The mathematics that marking, Vault matching and evaluation read stays the
  clean line (`2(x+3)`), unchanged — the sensor mark and placeholder cells are
  drawing only.

## Steps

1. **Vertical sensor movement, Game-safe.** Add a Game-only sensor move that
   uses the Smartboard's own structure movement and does nothing at all when
   there is no structure above/below — no line change, no fallback.
2. **Report what is possible.** Compute "can go up" / "can go down" from that
   same movement returning nothing, and feed it to the pad so the keys dim
   exactly when they cannot act.
3. **Four keys in the Game.** Show the full pad inside Game chrome (currently
   horizontal-only), keeping it clear of the Floating Numbers strip and the HUD
   and reachable on a phone.
4. **Raised placeholders in the surface mirror.** Extend the Game mirror so
   exponents and subscripts are written with raised/lowered characters where
   every character has one, and an empty script cell shows a raised/lowered box
   attached to its base instead of `^(□)`. Brackets, fractions and roots keep
   their visible boxes as now.
5. **Verify on the Game surface.** `S + 7` — ← → reach every position; `2(S + 3)`
   — the sensor enters and walks the bracket; an exponent cell — ↑ activates only
   at the right position and ↓ returns; a plain position — both vertical keys
   dimmed and inert; repeated ← → never leave the line; save, exit, reopen and
   the structures, cells and sensor state are still correct.
6. **Tests.** Extend the existing mirror tests with raised scripts, empty script
   cells, and vertical-move availability.

## Technical notes

- Reuse `moveUp` / `moveDown` / `moveLeft` / `moveRight` and `SLOT_GLYPH` from
  `src/lib/smartboard/mathTree.ts`. No second cursor model, no second
  placeholder model.
- `src/components/smartboard/PresentationView.tsx`: a game branch for the pad's
  `onUp`/`onDown` that calls `treeMoveUp`/`treeMoveDown` only (the existing
  `nudgeCursor` keeps its line fallback for the Smartboard); pass
  `canUp`/`canDown` from those functions returning `null`; drop
  `horizontalOnly` for game chrome.
- `src/lib/smartboard/rowCaret.ts`: script-aware mirroring — Unicode
  superscript/subscript glyph mapping with `^(…)` / `_(…)` as fallback, and a
  raised placeholder box for an empty script slot. Keeps emitting the decorated
  string only through `onLineDisplayText`; `onLineText` stays plain.
- Untouched: Smartboard UI and behaviour, Floating Numbers logic, grading,
  predictive evaluation, rewards, Vault rules, sounds, surfaces, rooms, camera.

## Still open from before

The approved question-assignment work (a second question assigned to the same
class + game must become Level 2, plus moving `x + 7 = 12` into a class) has not
been built yet. I will do that straight after this fix unless you want it first.
