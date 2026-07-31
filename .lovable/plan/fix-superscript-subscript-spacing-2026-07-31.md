# Fix superscript / subscript spacing (`#`, `##`)

## What I reproduced

I typed `A x 10#n` in a lesson note and inspected the result. Two separate defects, which together explain why it sometimes looks perfect and sometimes blows apart:

**1. Every script slot is ~20px wider than its content.**
Measured on a real `10ⁿ` in the note:

```text
slot "10"   content 16.0px   box 36.0px    (grid column = 36px)
slot ""     content  0.0px   box 25.4px    (empty subscript still occupies a full cell)
slot "n"    content  5.4px   box 25.4px    (grid column = 24.9px)
```

The slots are centred inside their oversized boxes, so the dead width shows up as a gap on both sides — roughly 10px between `10` and `n`, plus 10px before `10`. Backspace can't remove it because it is layout, not characters. The whole structure measures 61px for two glyphs, which is also why the line wraps early.

The script layouts (`power`, `sub`, `subsup` in `src/styles.css`) are the only math structures built as `display: inline-grid` with `max-content` columns and stretched, centre-aligned cells. The read-only renderer, by contrast, emits a plain `<sup>` with `margin-left: 1px` and measures tight — that output is correct today.

**2. Pressing `#` inside an existing script slot nests a second structure.**
The captured DOM shows a `subsup` whose superscript slot contains *another* complete `subsup` (base `n`, two empty slots). Nested structures multiply the per-slot dead space, which is exactly the "sometimes it's fine, sometimes it's huge" behaviour.

## Fix

**Layout — make the editable script match the read-only renderer.**
- Rebuild the `power`, `sub` and `subsup` rules to a tight inline layout: base as normal inline content, script as an inline-block with `vertical-align` offset and `margin-left: 1px` (the same metrics `mathRender.ts` already uses), instead of grid cells.
- Script slots get `text-align: left`, `min-width: 0`, `min-height: 0`, no padding — so a slot is exactly as wide as what's in it.
- An empty script slot contributes zero width unless the structure is focused; when focused it gets the small `0.5em` placeholder box so the caret is visible and clickable. The caret-anchor widget must not add width.
- In `subsup`, a script slot with no content is not laid out at all, so `10ⁿ` never reserves room for an unused subscript.

**Keystroke — never nest a script inside a script.**
- In the `#` handler (`MathKeyShortcuts.ts` for prose, `MathInlineCanvas.tsx` for the canvas), detect that the caret is already inside a `sup`/`sub` slot of a script structure. In that case move the caret into that existing slot (or switch sup→sub for `##`) instead of wrapping the term in a new structure.
- Result: `#` always produces one flat `base + script` object, matching the good case.

## Verification

Re-run the same typed sequence in the editor and re-measure: each slot's box width must equal its content width (±1px), the empty subscript must contribute 0px, and `A × 10ⁿ` must render as one tight unit on a single line. Also check `x#2#5` style repeats and the presenter/Smartboard view, which share the same stylesheet.

## Technical notes

- Files edited: `src/styles.css` (script structure rules only), `src/components/lessonnotes/extensions/MathKeyShortcuts.ts`, `src/components/lessonnotes/extensions/MathInlineCanvas.tsx`.
- No change to the math document model, LaTeX serialisation, or any non-script structure (fraction, root, matrix, bigop, etc. keep their current grid rules).
