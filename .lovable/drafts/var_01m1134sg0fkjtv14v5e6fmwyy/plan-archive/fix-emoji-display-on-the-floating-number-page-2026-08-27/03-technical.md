## Technical detail

Scope is deliberately narrow: the equation-atom reader and its renderer.

- `src/lib/floating/atoms.ts` — the `Parser` class walks with `this.s[this.i]` and `this.i++`. Add a grapheme-aware read at the top of the character loop using the existing `graphemes` / `isEmoji` helpers in `src/lib/text/graphemes.ts` (already the app-wide authority). When the next user-perceived character is pictographic, emit one atom carrying the whole grapheme and advance by its length. Same treatment in `readBraceOrChar()` and `parseGroupOrNext()`, which currently consume exactly one code unit.
- `src/components/floating/EquationAtoms.tsx` — when an atom's value is an emoji, render it with `EMOJI_STYLE` (colour-emoji font, `fontSize: 1em`) so it is not tinted, filtered or resized by the ink styling; keep the existing selection, hover and chip-apply behaviour unchanged.
- Untouched: `mathTokens.ts`, the floating compiler, chip generation, `PresentationView`, marking/equivalence, Auto Generate, and the emoji concept and size.

## Tests

- Unit: parsing `🍎 + 2🚗 = 14` yields atoms `🍎`, `+`, `2`, `🚗`, `=`, `14` — no replacement character, no split surrogate; plus a joined-sequence and a skin-tone emoji case.
- Regression: existing atom tests for fractions, radicals, brackets, matrices and Σ/∫ structures keep passing.
- Browser check on the Floating Number page for this question: emojis visible on load, still visible after selecting and committing a chip, and the Smartboard render unchanged after save.
