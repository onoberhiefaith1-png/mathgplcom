# Fix: Debug labels (`POWER_SLOT`, `SCRIPT_0`) leaking into chip labels

## Root cause

`src/lib/notebook/unicodeMath.ts` uses textual sentinel strings to hide partial
LaTeX from intermediate regex passes:

```ts
const POWER_SLOT = "\uE000POWER_SLOT\uE000";
const token      = `\uE001SCRIPT_${n}\uE001`;
```

The bracketing private-use characters (`\uE000`, `\uE001`) are invisible, but
the **literal ASCII payload** (`POWER_SLOT`, `SCRIPT_0`, `SCRIPT_1`, …) is
plain readable text. If anything downstream strips or normalizes private-use
characters — or if the sentinel survives into a context where the surrounding
`\uE000` is rendered as a glyph and ignored — the teacher sees the raw debug
words. That is exactly what the report describes (`x POWER SCRIPT LOT`, etc.).
There are no other sources of those strings in the rendering layer.

## Fix (rendering-layer only)

Replace the ASCII payloads with **pure private-use code points** so the
sentinel can never expose readable text under any circumstance:

```ts
const POWER_SLOT = "\uE000\uE010\uE000";
const holdScript = (markup) => {
  const idx = scriptSlots.length;
  const token = `\uE001${String.fromCharCode(0xE100 + idx)}\uE001`;
  scriptSlots.push(markup);
  return token;
};
```

The restore step at the bottom of `toUnicodeMath` already swaps these tokens
back to their real markup before returning, so behaviour is unchanged for
every well-formed input. Only the worst-case leak becomes invisible PUA
characters instead of the words "POWER SCRIPT LOT".

As a defence-in-depth belt, also strip any leftover PUA sentinel from the
final output (right before `return s.trim()`):

```ts
s = s.replace(/[\uE000-\uE0FF]/g, "");
```

## Out of scope (do not touch)

- Floating-number generation, AI prompts, highlight engine, merge/split,
  structure detection, metadata, Apply button, editor behaviour.
- `renderMathInline` already renders `\frac`, `\sqrt`, `^{…}`, `_{…}`,
  brackets, abs, integrals, summations, matrices as real math — no changes
  needed there.

## Files to edit

- `src/lib/notebook/unicodeMath.ts` — sentinel constants + final PUA strip.

## Verification

- Existing tests under `src/test/` (highlight engine, floating laws,
  extractor, unicode math) must still pass.
- Manual: create `x^2`, `(a+b)^2`, `\frac{a+b}{c+d}`, `\sqrt{(a+b)/(c+d)}` —
  chips render as `x²`, `(a+b)²`, stacked fraction, nested radical. No ASCII
  debug words appear anywhere.
