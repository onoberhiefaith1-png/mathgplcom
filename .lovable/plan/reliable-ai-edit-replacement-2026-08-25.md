# Reliable AI Edit replacement

## Goal
When a teacher highlights lesson-note content, generates an AI Edit proposal, and accepts it, replace exactly the highlighted content with the accepted proposal. The preview must not disappear unless that replacement succeeds.

## Implementation
1. **Preserve the edit target**
   - Capture the selected range, selected document slice, and document context when AI Edit opens.
   - Keep that target stable while the side panel is open, rather than depending on the browser’s current selection after focus moves to the panel.

2. **Use one atomic replacement transaction**
   - Convert the accepted proposal through the existing lesson-note node parser so prose, mathematics, matrices, statistics, Maths Tables, and Smart Tables retain their proper editable structures.
   - Replace the saved selection in one editor transaction, including selections inside a paragraph and selections spanning complete blocks.
   - Preserve content before and after a partial-line selection without rebuilding or altering unrelated content.

3. **Confirm success before closing**
   - Make the Apply callback report whether the editor transaction succeeded.
   - Close and clear the AI Edit state only after a successful replacement.
   - If the saved target is no longer valid, leave the proposal visible and show a clear retry message instead of silently doing nothing.

4. **Regression coverage**
   - Test replacement of plain text, inline mathematics, a full math line, multi-line content, a matrix, and table directives.
   - Verify the selected content is removed, the accepted content occupies the same location, surrounding content is unchanged, and Undo restores the original selection.

## Technical notes
- Reuse `aiTextToNodes` and the existing structure materializers; do not create another renderer or flatten structured output.
- Remove the duplicate unconditional close between the panel and editor ownership path.
- Keep asset-specific AI Edit callbacks working through their existing bridge.
