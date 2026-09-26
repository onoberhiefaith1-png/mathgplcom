# Game Play — make Play show exactly what Edit saved

Edit is the only configuration. Play reads that saved configuration and nothing else.

## What I checked first

- Play already loads the saved Game from the database (`loadGame`) and hands it to the 3D world, so the Game-level surface, colour, text style and lighting do arrive.
- The gap is per-line: when Play builds the slate for a question it copies the *reward pattern slot* for each line, and the 3D column still paints **one single surface for the whole slate**. So a surface chosen for Line 1 only can never show up — not in Play and not in Edit.
- The line number is drawn at a fixed far-left column position, independent of how wide the surface actually is. That is the big gap you can see between `1` and the surface.
- The line's hourglass is positioned on the left (12% across) and the vault at 82%.
- Each line currently allows **one** vault expression, and it is matched against the whole line, not as a part of the student's work.
- The top HUD shows a coin icon and a coin count.

## What I will build

### 1. Per-line appearance actually reaches the slate
Each writing surface reads its own saved configuration (surface/material/colour/texture, text style, text colour, depth colour, size, effects), falling back to the Game-wide setting when the teacher has not overridden that line. The same resolver is used by the editor preview and by Play, so the two can never disagree. Save in Edit, press Play, and Line 1 is Parchment Scroll.

### 2. No defaults after Play starts
Play resolves every visual value through the saved-configuration resolver. Where a value is missing it falls back to the Game's own saved value — never to a fresh built-in default. Play also re-reads the Game each time it is opened, so a refresh shows the latest save.

### 3. The number belongs to the surface
The line number is moved to sit immediately beside (or on) the surface, using the surface's real measured width, same depth, material, lighting and shadow as the slab — one physical object, not a floating label. Surface N always carries number N. Its appearance stays editable in Settings.

### 4. Hourglass moves to the right of its line
Functionality and timing are untouched. Only the placement changes: the hourglass sits on the right-hand side of its own writing surface.

### 5. HUD: Vault replaces Coin
The HUD becomes Time | Life | Vault, with a vault indicator in the Game's premium style. The word "coins" disappears from Game mode — in the HUD, the messages and the completion screen.

### 6. Vault codes, up to 10 per line
Beside the existing Floating Numbers line controls (where the hourglass share already lives) each line gains a **Vault Code** area: add up to 10 expressions such as `x + 7` or `x + 3 + 2 + 1`, each with its own reward value. Only the codes the teacher actually enters exist. Existing single-expression configurations are read as the line's first code, so nothing already saved is lost.

### 7. Vault detection on mathematical structure, not text
While the student solves a line, each configured code is compared against the mathematical structure of that line's Floating Numbers work using the existing equivalence engine. A code is recognised when it appears **inside** the work — `x + 7` opens on `x + 7 = 12`. No string equality, no reading the screen.

### 8. Vault reveal
On detection the vault wakes, the encrypted content unseals and the hidden expression is revealed with the vault's existing opening effect, then the reward is paid and the HUD vault count updates. The existing vault object and its encryption are reused.

### 9. One active line, three ways to change it
Tapping a surface, scrolling the slate and the Floating Numbers line arrows all write to the same single active line. When it changes, the surface, the Floating Numbers line, the line timer, the hourglass, the vault codes and the completion state all move together. Line 5 mathematics cannot land on surface 2.

## Technical notes

- New `resolveLineAppearance(game, lineId)` in `src/lib/slate/lineSurfaces.ts`; `SlateColumn` resolves surface/text per region instead of once per game. `GamePlayPage`'s `displayGame` carries the resolved appearance per slot alongside the pattern rewards.
- `LineSurfaceConfig` gains `vaultCodes: { expression: string; reward: number }[]` (max 10) plus normalisation from the legacy `vaultExpression`/`vaultCoins`; `normalizeGame` migrates on load, so no database migration is needed.
- `vaultMatches` extended to sub-expression recognition over the canonical form; `mapQuestionLines` emits one vault object per configured code and moves the derived hourglass to the right.
- `useGameRuntime`: `coins` presented as vault count; reward keys per vault code so each opens once.
- Arrow navigation: the panel's line context index is fed into `selectLine`, keeping one authoritative active line.

## Out of scope

Floating Numbers authoring, marking and AI evaluation; the Smartboard; Classes, assignments and reports; hourglass timing rules; Adventure.

## Verification

Typecheck, the slate unit tests, and a browser pass: change surface, text style, text colour, depth colour, a reward position and a vault code in Edit → Save → Play shows exactly those values → refresh → still exactly those values.
