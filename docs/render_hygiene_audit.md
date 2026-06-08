# Render Hygiene Audit

Last reviewed: 2026-05-31

This doc lists every place where mathematical text becomes pixels and what
guarantees we make about the input that reaches it. The goal: a teacher
should never see raw `$…$`, `\frac`, `\sqrt`, `^{...}`, `_{...}`, `sqrt(`,
`**`, or the literal word "square" on screen.

## Pipeline

```
source string                       (lesson note / AI / DB)
   │
   ├─►  toUnicodeMath()             (src/lib/notebook/unicodeMath.ts)
   │     - strips $…$
   │     - converts \sqrt, ^{}, _{}, \cdot, \pm, …
   │     - LEAVES \frac{a}{b} intact so it can render as a stacked fraction
   │
   ├─►  isStillDirty()              (rejects fillers containing \word, ^{, _{, sqrt(, **)
   │
   └─►  renderMathInline()          (src/lib/notebook/mathRender.ts)
         - calls normalizeMath() which also strips $…$
         - parses \frac, \sqrt, ^{...}, big operators, matrices, accents
         - emits real React stacked spans
```

## Call sites

| File | Function used | Stripped of `$…$`? | Notes |
|---|---|---|---|
| `src/pages/FloatingNumbersPage.tsx` | `renderMathInline(info.problem)` | ✓ via normalizeMath | Problem string is raw lesson-note source. |
| `src/pages/FloatingNumbersPage.tsx` (ViewSession chips) | `renderMathInline(label)` | ✓ | Fillers also pre-cleaned via `toUnicodeMath` + `isStillDirty`. |
| `src/components/lessonnotes/FloatingWorkspace.tsx` | `renderMathInline` | ✓ | Equation row + filler chips. |
| `src/components/lessonnotes/FloatingDisplayStrip.tsx` | `renderMathInline` | ✓ | |
| `src/components/smartboard/PresentationView.tsx` & friends | `renderMathInline` / `MathTreeRender` | ✓ | Smartboard pulls from `floating_bucket` which is pre-cleaned server-side. |
| `src/components/lessonnotes/LineEditableMath.tsx` | `renderMathInline` | ✓ | Editable slot mode. |

## Rules

1. **Dollar signs**: `$` and `$$` are valid in lesson-note source (mirrors a
   notebook's KaTeX habit) but are STRIPPED at the boundary by both
   `toUnicodeMath` and `normalizeMath`. They must never reach the DOM.
2. **Fractions**: AI must emit `\frac{a}{b}` in the `equation` field of
   floating output. Fillers contain the numerator and denominator
   separately and the line declares `"fraction"` in `containers`.
   Slash form `a/b` is forbidden for true fractions because it reads as
   `(a/b)·…` on the board.
3. **Transitions**: When a term on line N+1 is the result of applying ÷,
   ×, ^ or √ to a term on line N, the floating bucket must emit the
   source pieces (prev term + the scalar) as separate fillers + the
   joining structure. Enforced both via the AI prompt (HARD RULE #3) and
   the deterministic `expandTransitionLine` post-processor in
   `FloatingNumbersPage.tsx`.
4. **`isStillDirty`** drops fillers that still contain `\word`, `^{`,
   `_{`, `sqrt(` or `**`. The equation field is *not* dirty-checked
   because it legitimately keeps `\frac{…}{…}` for the renderer.
5. **Pedagogical macros**: `MATH_MARKUP_RULES` (in `notebook-ai`)
   forbids the literal word "square" as a placeholder; `\square` is fine.

## Known limitations

- `expandTransitionLine` is structural (string match), not algebraic. It
  catches `−10x/3` ← `−10x` ÷ `3` but will not catch, say, `−5x` ←
  `−10x ÷ 2` once the AI evaluates the result. That is by design — the
  prompt instructs the AI not to evaluate, and the post-processor is the
  backstop.
- `\frac` survives only inside the equation string. If a teacher pastes
  a literal `\frac{1}{2}` into a problem, `normalizeMath` will still draw
  it stacked correctly because `mathRender` parses `\frac` directly.
