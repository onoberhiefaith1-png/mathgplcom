# Game Mode + Vault in the Floating Numbers generator

Goal: keep the existing Floating Numbers generator exactly as it is, and add an optional GAME mode. In Game mode the teacher gets timers and a destination switch, so the same tap-the-equation → Apply action can send the selected mathematics either to Floating Numbers or to the Vault. No typing of mathematics anywhere.

## 1. GAME switch in the top bar

Top bar order becomes: Back · Generate · Save · Shuffle · GAME (then the existing Test on Smartboard / Archive / Reset stay where they are).

GAME has a clear on/off look and is OFF by default. It is saved with the question, so reopening the page restores it.

When GAME is OFF the page looks and behaves exactly as today, with these hidden:
- the question time control
- each line's own time box
- the destination switch
- the Vault list

## 2. Game settings strip (only when GAME is ON)

A single strip under the question shows:
- Overall time for the question (mm:ss)
- Each line keeps its own time box on its own row (mm:ss)

These are the same time values the Game already uses today; Game mode only controls whether they are shown.

## 3. Destination switch (the core change)

Inside each line, when GAME is ON, a two-option switch appears next to the equation:

```text
DESTINATION   [ FLOATING NUMBERS ]  [ VAULT ]
```

Default is FLOATING NUMBERS.

The teacher taps parts of the equation exactly as now and presses Apply (or Enter):
- Destination FLOATING NUMBERS → the selection becomes Floating Numbers, unchanged from today's behaviour.
- Destination VAULT → the same selection is saved as one new Vault entry for that line, and the Floating Numbers are left untouched.

There is one selection mechanism. No Vault text box, no second editor.

## 4. Vault list (only when GAME is ON)

Under the line: VAULT, listing each saved entry as rendered mathematics (Vault 1, Vault 2 …), with reorder and delete. Unlimited entries per line. Adding is only ever done through select → Apply. The free-text Vault input is removed.

## 5. What does not change

- Floating Numbers generation, Apply, Generate, Shuffle, marks, line assignment, Smartboard and mobile Floating Numbers.
- The Game side already turns saved Vault entries into the existing gold/blue Vault cylinder rewards on the matching Game line, hides the expression from students, matches the exact consecutive sequence (equivalent-but-different methods do not open it), reveals and collects once, and survives Reset. No Game or reward changes in this work.

## Technical notes

- `FloatingScoring` gains `gameMode?: boolean` (stored in the existing `notebook_subsections.floating_scoring` JSON, default false). No migration needed.
- `EquationAtoms` keeps one selection engine; its `onApply` gains a destination argument. `applySelection` still produces the chips; for the Vault destination the workspace takes the chips introduced by this selection (in selection order), joins their `value`, and appends `{ id, expression }` to `line.vaults` without writing `fillers`. Structural selections (fractions, roots, exponents) therefore carry their LaTeX exactly as Floating Numbers do.
- `FloatingWorkspace` holds per-line destination state (not persisted), gates timers/destination/Vault list on `scoring.gameMode`, and drops the manual Vault expression inputs while keeping reorder/delete.
- `normalizeFloatingVaults` and the existing save path already persist Vault ids, order and line ownership; unchanged.
- Tests: destination routing (Floating Numbers vs Vault), Vault ordering/ids, Game OFF hides Game controls, existing Vault sequence-matching tests stay green.
