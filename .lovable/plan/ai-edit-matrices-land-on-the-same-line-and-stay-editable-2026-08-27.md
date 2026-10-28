# AI Edit — matrices land on the same line and stay editable

## What is wrong today (confirmed in code)

When AI Edit returns something like `A = \begin{bmatrix}3 & 2\\5 & 4\end{bmatrix}`, the converter
in `src/lib/lessonnotes/aiToNodes.ts` cuts the text at the matrix boundary (`splitRawMatrices`) and
then `matrixNode()` wraps the matrix in **its own paragraph**. The leftover `A =` becomes a separate
`mathBlock` line. That is exactly why the board shows

```text
A =
[ 3  2 ]
[ 5  4 ]
```

Two consequences:

- The matrix can never sit beside `A =`, because they are different block nodes.
- The `A =` line is a `mathBlock`, which is an atom (`atom: true` in `MathBlock.tsx`) — the caret
  cannot be placed before/after the matrix within one expression, so Backspace/Delete and inserting
  symbols around the matrix behave unnaturally.

The good news: the matrix itself is already a real structured, editable object. `mathStructure`
(kind `matrix`) is **inline**, with one independent editable `mathSlot` per cell. Nothing about it is
an image or a rigid block — it is only being placed in the wrong container.

## The fix

1. **Line-aware conversion.** Split AI text into lines first, then handle matrix environments
   *inside* each line, instead of splitting the whole blob at matrix boundaries. `A =` and the
   matrix stay in one line.

2. **Matrix becomes inline content, not a paragraph.** Change the matrix builder to return the
   inline `mathStructure` node (kind `matrix`, `rows × cols` independent `mathSlot`s, bracket
   preserved) and place it inside the same paragraph as the surrounding text/`mathInline` runs.
   The paragraph result is `[ text "A = " ][ matrix structure ]`.

3. **No atom line for matrix lines.** A line containing a matrix always goes through the paragraph
   (inline) path, never the `mathBlock` atom path, so the caret can sit before and after the matrix
   and ordinary typing, Backspace and Delete work as they do for a manually inserted matrix.

4. **Apply path unchanged in spirit.** `applyAiEdit` in `DocumentEditor.tsx` already replaces an
   inline selection with the generated paragraph's inline content when the proposal is a single
   paragraph. With step 2 the matrix now travels through that same branch, so an AI matrix is
   inserted into the caret's own line rather than as a block below it.

5. **Vertical centring only as presentation.** The matrix already renders its rows internally; the
   surrounding `A =` is aligned to the matrix's vertical centre through existing math-structure CSS.
   No new layout system.

## Tests

New cases in `src/lib/lessonnotes/__tests__/aiStructuredEdit.test.ts`:

- `A = \begin{bmatrix}3 & 2\\5 & 4\end{bmatrix}` → **one** paragraph containing text `A =` plus one
  inline `mathStructure` matrix (2 rows, 2 cols, `[` bracket, 4 independent slots) — no extra
  paragraph, no `mathBlock`.
- Same for `B = …` and for a matrix followed by trailing text (`… is singular`).
- 2×3, 3×2, 3×3 matrices keep their dimensions and cell values in row-major slot order.
- Multi-line AI output (`A = …` newline `B = …`) yields two paragraphs, each self-contained.
- `det(A) = (3)(4) - (2)(5)` still round-trips as ordinary editable math (regression).
- Existing matrix, fraction, radical and big-operator tests must keep passing.

Then a browser pass on the lesson note: run AI Edit to produce `A = [matrix]`, click before and
after the matrix, type on both sides, Backspace/Delete around it, edit one cell, reload the note and
confirm the content is still a valid editable 2 × 2 matrix.

## Out of scope

No changes to the Smartboard, marking/assessment, Floating Numbers, the manual Matrix tool, or the
math renderer's engine. The only behaviour changed is where AI-generated matrices are placed and
which container they live in.
