## Technical scope

- `src/lib/notebook/mathRender.ts`
  - `connectedRadical` (43-105): accept a computed headroom and apply it to the bar span's `paddingTop`; keep `alignItems: stretch` so the hook follows.
  - Both `\sqrt` branches (677-722): compute headroom from the radicand source (script markers, nested structures with scripts) and pass it in.
  - Superscript branch (851-878): contained raise instead of `verticalAlign: "super"` so `<sup>` no longer overflows its line box. Subscript rule left alone.
- `src/styles.css` (759-768): `.math-struct--sqrt` / `--cuberoot` / `--nroot` slot padding becomes content-aware and the `√` glyph stretches with the row, matching the rendered output in the editable surface.
- No change to `normalizeMath`, `mathLayoutNormalize`, the smartboard tree renderer's structure, or the Smart Table.

## Verification

In the live preview, render `\sqrt{\frac{(x-\mu)^2}{N}}` in a lesson note and check the `²` sits fully under the overline with the hook joined; then type the same inside an editable root and inside a Smart Table cell. Confirm a plain `\sqrt{16}` stays as compact as it is today.
