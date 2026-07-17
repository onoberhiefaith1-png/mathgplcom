
## Goal

Type math naturally in the note. No orange chip, no "one atomic object". `x`, then `#` — cursor jumps up and shrinks, the next characters are the superscript. Press `#` again — another level up. `##` — cursor goes down (subscript). Arrows walk the caret through every level. Space returns to the baseline. Nesting is unlimited because it's just a level counter on ordinary prose characters.

## The core idea

Superscript / subscript stop being a container. They become a **numeric "level" attribute** attached to every typed character as a normal TipTap mark:

- `level = 0` → baseline text
- `level = +1` → superscript
- `level = +2` → superscript of a superscript
- `level = -1` → subscript
- `level = -2` → sub of a sub
- mixed depths like `x⁽²⁾ ₙ` are just adjacent characters with different levels

Because the level is just a number on plain prose, there is no atomic object. The caret is the browser's native caret. Backspace deletes one character. Left/Right walk one character. Selection, copy/paste, undo — all free.

## Behaviour

### Typing
- `#` at any caret position: raise the active level by 1 (superscript up). Next chars type at that level.
- `##` (two `#` typed in a row with no character between): lower the active level by 2 from where `#` had raised it → net one level of subscript. So from baseline: `#` = sup, `##` = sub, `###` = sup², `####` = sub² (each pair flips one deeper).
  - Implementation: first `#` bumps active level up 1; if the second key is also `#` within the same intent (no other input), we drop it by 2 to land on the opposite side of baseline. Same rule recursively.
- The `#` character itself is never inserted into the document.
- `Space` at any non-zero level: return active level to 0 (baseline). Once we are at level 0, subsequent `Space` behaves as a normal space (does not eat it).
- `Enter`, punctuation-that-ends-a-word (`,`, `;`, `=`, ` `): also reset to 0.

### Caret navigation
- `←` / `→`: standard prose caret. Because levels are per-character marks, the caret naturally moves between characters at different levels and inherits the level of the character it sits next to.
- `↑`: bump active level +1 (same as `#`) without inserting.
- `↓`: bump active level −1 without inserting.
- The "active level" for the next keystroke is derived from the character to the left of the caret, plus any pending `↑`/`↓`/`#`/`##` adjustments. So after `x²`, if the caret is placed just after the `2`, typing continues at level 1; pressing `Space` drops it back to 0.

### Rendering
- A single mark `mathLevel { level: number }`.
- `renderHTML` emits a `<span class="ml-lvl" data-lvl="{n}">` with inline style:
  - `font-size: {0.75 ^ |level|}em`
  - `vertical-align: baseline` and `transform: translateY({-0.45em * level})` (positive level → up, negative → down)
  - `line-height: 1`
- No colours, no borders, no chip — visually identical to real `<sup>`/`<sub>` chains, but selectable per character.

### The orange chip
- `#` in prose no longer creates a `mathInline` node. That path is removed.
- `mathInline` stays only for genuine structural math (fraction, square root, matrix — inserted from the Structures menu or `/`). Simple powers/indices are handled by the level mark.
- `##` no longer needs to open a math node at all.

## Files to add / edit

**New**
- `src/components/lessonnotes/extensions/MathLevelMark.ts` — TipTap Mark:
  - `addAttributes`: `level: number` (default 0; 0 is stripped on paste).
  - `renderHTML` / `parseHTML` as described.
  - Command `setMathLevel(level)`, `bumpMathLevel(delta)`.

**New**
- `src/components/lessonnotes/extensions/MathLevelInput.ts` — ProseMirror plugin that:
  - Tracks `activeLevel` (starts at 0, refreshed on selection change to match the char left of the caret).
  - Tracks `pendingHash` boolean (last key was `#`, no other input since).
  - `handleTextInput(ch)`:
    - If `ch === "#"`:
      - If `pendingHash`: consume, `activeLevel -= 2`, clear `pendingHash`. Return true (nothing inserted).
      - Else: `activeLevel += 1`, `pendingHash = true`. Return true.
    - If `ch === " "` and `activeLevel !== 0`: `activeLevel = 0`, `pendingHash = false`. Return true (space not inserted; it was the exit signal).
    - Else: insert `ch` with `mathLevel({ level: activeLevel })`, clear `pendingHash`.
  - `handleKeyDown`:
    - `ArrowUp` → `activeLevel += 1`, prevent default vertical caret jump inside the same line; if the caret would leave the block, fall through to default.
    - `ArrowDown` → `activeLevel -= 1`, same rule.
    - `Backspace` → default; then re-derive `activeLevel` from the new left-of-caret char.
  - Exposes `activeLevel` on the plugin state so a small status pill (optional, later) can show the current level.

**Edit**
- `src/components/lessonnotes/extensions/MathKeyShortcuts.ts` — delete the `handleTextInput` branch that promotes the previous term into a `mathInline` on `#`. Keep bracket auto-pair and `/` fraction shortcut untouched.
- `src/components/lessonnotes/DocumentEditor.tsx` (or wherever the editor extensions array lives) — register `MathLevelMark` and `MathLevelInput`. Placement: after StarterKit, before `MathKeyShortcuts`.
- `src/components/lessonnotes/extensions/MathInline.tsx` — leave as-is for fractions/sqrt/matrix, but remove the `autoEdit`-on-mount focus path that the old `#` flow relied on (harmless if kept; will simply never fire from `#` anymore).

## Migration

Existing notes that stored `x^{2}` as a `mathInline` atom keep rendering through `MathInline` (no data change). Newly typed superscripts/subscripts use the mark. There is no forced conversion — the two coexist. Copy/paste out of an existing `mathInline` into prose still produces its LaTeX text; the user can retype with `#` if they want the new inline style.

## Edge cases handled

- Deep nesting: `x` `#` `2` `#` `#` `n` `#` `5` renders `x^{2_{n^{5}}}` visually with four separate level values; each character is individually editable.
- Mixed line: `E = mc²` — space after `=` resets level; caret then walks back through `²` (level 1) and `c` (level 0) with plain arrows.
- Selection across levels: shift-arrow selects characters regardless of level; Delete removes them; Backspace/undo behave normally.
- Copy out to plain text: mark strips to plain characters (`x2n5`). Optional refinement: `renderText` emits Unicode superscripts for common digits so paste-into-Slack still looks right. Not required for v1.

## Verification

- Type `x#2` — see `x²` with the `2` visually raised and smaller, cursor sitting just after the `2` at raised height.
- Press `←` — cursor moves before the `2`, still at raised height.
- Press `↓` twice — cursor lowers to baseline then to subscript.
- Type `n` — subscript `n` appears after `x²`.
- Press `Space` — cursor returns to baseline; typing continues normally.
- Backspace across the whole run removes one character at a time.
- No orange chip appears at any point.

## Out of scope for this plan

- Structural math (fraction, sqrt, matrix) — untouched, still uses `mathInline`.
- Click-to-position inside an existing `mathInline` — separate refinement.
- Unicode-on-copy — v2 nice-to-have.
