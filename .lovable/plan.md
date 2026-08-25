# Structure-aware AI Edit for Lesson Notes

## Goal
When a teacher pastes mathematical or statistical content and uses AI Edit, **Apply Changes** must insert the same structured result shown in the preview—not flatten it into raw matrix syntax, prose, or loose table values.

## Plan
1. **Give AI Edit the Lesson Note tool contract**
   - Send the live workspace manifest with edit requests, as generation already does.
   - Extend the edit prompt to require canonical directives for structured content:
     - matrices/vectors → editable Matrix structure
     - statistical/tabular data → editable Smart Table
     - ordinary mathematical layout → existing math structures
   - Keep diagrams outside this change.

2. **Complete structure materialization**
   - Add explicit parsing for matrix dimensions, bracket type, cell order, and optional matrix notation/functions.
   - Materialize matrices through the existing `mathStructure(kind="matrix")` schema and validator.
   - Materialize statistical tables through the existing `mathVisual(family="smarttable")` schema, preserving headers, rows, columns, and mathematical cell content.
   - Use the existing Maths Table/asset definitions where the AI identifies a registered fixed reference-table asset; otherwise use Smart Table for editable data.

3. **Make Accept structure-aware**
   - Detect whether the proposal contains structured directives before replacing the selection.
   - For plain inline edits, preserve the current inline replacement behavior.
   - For matrices, tables, or multi-block statistical layouts, replace at valid block boundaries and insert canonical TipTap nodes instead of collapsing newlines into one `mathInline` node.
   - Preserve surrounding unselected content and reject an invalid structure without damaging the note.

4. **Match preview to the accepted result**
   - Render proposed directives as the actual Matrix/Smart Table structure in AI Edit, so the teacher approves what will be inserted.
   - Ensure Apply and preview share the same parser/materializer and normalization rules.
   - Surface a clear validation error if a proposed matrix/table is incomplete rather than silently degrading it to text.

5. **Regression coverage and verification**
   - Add focused tests for pasted 2×2 and rectangular matrices, matrix multiplication output, frequency/statistics tables, mixed prose + matrix + table selections, and inline-only edits.
   - Verify matrix cell order, bracket shape, table headers/cell coordinates, editability after insertion, save/reload persistence, and no raw `\\begin{matrix}`, markdown table syntax, or tool directives in the Lesson Note.
   - Exercise one real AI Edit request and confirm Preview → Apply → saved Lesson Note retains identical structure.

## Technical notes
- Reuse the existing `aiTextToNodes`, directive materializer, `validateStructure`, Matrix node, and Smart Table node; do not introduce a second renderer or table system.
- Carry the selection snapshot JSON/kind through AI Edit so replacement decisions are based on document structure, not only flattened text.
- Keep the change limited to Lesson Note AI Edit and its structure conversion; diagram behavior remains unchanged.
