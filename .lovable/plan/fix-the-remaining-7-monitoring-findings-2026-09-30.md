# Fix the remaining 7 monitoring findings

Nine findings are already fixed. The seven below are confirmed but each touches core behaviour, so they go through this plan.

1. **Extra questions sent to a class Game** — when a class already has the Game, sending a new question adds it as the next Level instead of saying "Nothing changed". The dialog's question count shows that class's own questions.
2. **3D text disappearing while typing** — keep a readable flat copy of the line showing while the raised letters are being built, and whenever they can't be built (long line). It is hidden again once the raised letters appear, so you still only ever see one copy.
3. **Class Smartboard freezing** — the "same lesson" check reads the current lesson every time, not the one captured when the connection opened. A rejected frame asks the teacher for a full resend, and the 20-second safety refresh comes back.
4. **Solutions vanishing** — a Solution counts as belonging to a question at any heading level ("Example 2" included), so it is never deleted or moved away.
5. **Zoomed canvas cut off** — at 200–500% zoom you can drag across the whole slide, and the frame height stays the same when you zoom.
6. **Slow AI Edit with false warnings** — a small highlighted edit skips the whole-lesson checks and never shows a "no complete solution" warning. Each AI call gets a time limit.
7. **Maths lines turned into tables** — lines only become a Smart Table when they look like a real table (with a divider row). `|AB| = 8 cm` and absolute-value steps stay as maths.

## Technical notes
- AssignDialog: call assignQuestion for already-selected classes too. Load gameStats per class with `listGameQuestions(gameId, classId)`.
- DimensionalText/TileText: `fillOpacity = drawExtrusion ? 0 : fade`, and the same for tiles.
- useSmartboardSync: read notebookId/fingerprint from refs inside applyDelta. On a mismatch, reset the seq watermark and send `hello`. Restore the `usePolling` resync at 20s.
- questionPairs: count a Solution as owned when ensureOwnerQuestionId finds its owner at any level.
- CanvasSlideViewer: pan bounds use `baseWidth * visualZoom`. Measure `fit` before zoom.
- notebook-ai: in edit mode, skip verifyUpscale/verifySessionStructure retries and warnings. Put back the AbortController with AI_REQUEST_TIMEOUT_MS. Make convertHandTables require a `|---|` ruler row.
