# What changes

1. **Property list rows** — the relationship line and the principle/name in the Geometry
   Properties panel render as real mathematics: stacked fractions, radical with vinculum,
   superscripts and subscripts, ∠ and ° notation, upright `sin`/`cos`/`tan`.
2. **Student/Smartboard viewer** — the same rendering in the read-only guide view, so the
   right-hand dock on the Smartboard shows notation, never markup.
3. **Composer save** — the statement is canonicalised once before it is stored, so slash and
   caret shortcuts become proper structure at save time rather than surviving as raw text.
4. **Editing a property** — the inline edit fields keep showing the editable source (that is
   the input layer); the moment editing ends, the row displays the rendered form.
5. Filtering, selection, per-object association and property → diagram highlighting are left
   exactly as they are; they continue to use the stored `objectIds` only.

# Verification

Drive the real workflow in the preview: open the diagram, open the properties panel, click a
side, and add each of `YP = S#2-Z#2` under a root, `sin θ = S/Y`, `Y#2 = S#2 - Z#2`,
`AB = 5 cm`, `∠ABC = 78°`. Confirm each row renders as notation, then click a row and confirm
the correct diagram parts still light up, and that the values survive a refresh.
