# Fix powers and empty placeholders when a lesson note moves to the Smartboard

## The lesson note

The note is "Simplify the following expression using properties of powers" (the `x⁵ · x³ / x²` note). Its solution line is stored as:

```text
Recall:
a^{m} × aⁿ = a^{m+n}
```

Notice the note itself stores the same idea two different ways: `a^{m}` is a real power, while `aⁿ` and `x⁵⁺³` are just small look-alike characters typed on the normal line. That mixture is the root of what the teacher saw.

## What is actually going wrong (verified)

1. **Small look-alike characters are not powers.** `aⁿ`, `x⁵⁺³`, `x⁻²` are single flat characters. When the board copies the line it copies them as ordinary text sitting next to the letter, so the exponent lands at the wrong height and never behaves like a power. Verified: `aⁿ` arrives on the board as two ordinary characters.
2. **An empty exponent box vanishes.** `a^{□}` (a power waiting to be filled) reaches the board as a power with an *empty* exponent, and the board draws nothing at all there — the teacher sees only `a`. Verified: the exponent slot is emptied on the way in, and the board's script renderer skips an empty slot instead of showing a writable box.
3. **A small digit in front of a root is mistaken for a root index.** `x²√9` is read as "the 2nd root", i.e. the square disappears into the radical sign. Verified.
4. **Chips can snap back.** The board's text form of a power (`(a)_()^(m)`) does not match the chip's own text (`a^{m}`), so a chip that was correctly written may not be recognised as used.

## The fix

- **One shape for powers everywhere.** At the single boundary where a note line becomes board ink, lift any run of small super/sub look-alike characters back into a real power or index (including signed and multi-character exponents such as `⁵⁺³`, `⁻²`, `ᵐ⁺ⁿ`). The note keeps whatever a teacher typed; the board always shows a genuine, correctly-raised power.
- **Empty exponents stay visible and writable.** Keep the placeholder box inside power/index slots instead of clearing it, and make the board draw an empty power slot as a visible, clickable cell — the same way an empty fraction or root slot already shows one. So `a^□` shows `a` with an empty box raised as its exponent, ready to be filled or written into from the Floating Numbers.
- **Roots stop stealing exponents.** Only treat small digits as a root index when they genuinely belong to the radical, so `x²√9` keeps its square.
- **Chip matching made shape-aware.** Compare chips and board ink in one common form so a written chip reliably moves to the Used zone and an erased one returns.
- **Prevent recurrence** with tests over the exact lines from this note plus the related shapes: `a^{m} × aⁿ = a^{m+n}`, `x⁵⁺³`, `x⁻²`, `a^{□}`, `\frac{a^{m}}{aⁿ}`, `(a^{m})ⁿ`, `x²√9`, and nested `a^{m × n}`.

## Scope

Only the note-to-board math conversion, the board's power/index drawing, and chip matching change. No change to lesson-note authoring, the AI solution engine, layout, navigation, or any other board behaviour.

## Technical notes

- `src/lib/smartboard/mirrorFromLessonNote.ts` — add a Unicode-script re-lift pass before `latexToRow`; restrict the `SUP_DIGITS` root-index branch to digits immediately preceding `√`.
- `src/lib/smartboard/mathTree.ts` — `collapseNestedBoxes` must not empty `subsup` sub/sup rows.
- `src/components/smartboard/MathTreeRender.tsx` — `subsup` case: an empty-but-present script row renders a placeholder cell rather than nothing.
- `src/lib/smartboard/rowAscii.ts` / floating presence normalisation — canonicalise `(a)_()^(m)` and `a^{m}` to the same key.
- Tests in `src/lib/smartboard/__tests__/` covering the shapes above.
