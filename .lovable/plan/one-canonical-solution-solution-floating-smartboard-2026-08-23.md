# One canonical solution → Solution, Floating, Smartboard

## What is actually wrong

Confirmed by reading the pipeline:

- When a lesson note is saved, the solution is flattened into a single plain-text field (`content_ascii`). Both the Floating page and the Smartboard read that same flattened text and then each re-parse it back into mathematics with their own parser.
- The flattener has a case for inline/block math but **no case for the visual math structures** (fraction, matrix, super/subscript). Their slots get glued together with nothing between them, so `67cm / sin60` written as a stacked fraction loses its structure on the way out. That is why Floating and the board show a different shape than the Solution page.
- Diagrams are not lost by accident: a rule in the code marks every diagram as "notes layer, never floatable", and the Floating page skips non-floatable objects when building its sequence. Diagrams are only re-attached as a note of the entry above, which is why they can be invisible in the Floating view.
- The faint slash/ghost marks in the lesson-note diagram come from the editing canvas deliberately drawing hidden points as translucent markers, plus in-progress preview strokes that are not always cleared.

## The fix

### 1. Canonical solution representation
Keep the existing save flow, but persist the solution's **structured nodes** next to the flattened text, and make the flattener lossless:

- Add a math-structure case to the flattener so a fraction always serialises as a real fraction (`\frac{...}{...}`), and the same for powers, indices, roots and brackets.
- Save a `nodes` array (document-ordered blocks: prose, math, object) on the solution block alongside `content_ascii` and `objects`. `content_ascii` stays for backwards compatibility.

### 2. Floating page renders the canonical solution
- Keep the highlight → chip workflow exactly as it is.
- Build the Floating document from the canonical node list instead of splitting a string: each line renders through the same math renderer the Solution page uses, so fractions stay stacked and indices stay raised.
- Diagrams stay non-highlightable and non-floatable (that rule is correct), but they must be **displayed inline, in document order**, using the existing `SolutionObjectView`, i.e. between the working above and below them — not only as an attachment of the previous entry.

### 3. Smartboard uses the same source
- The board already consumes the same block; point its model builder at the canonical nodes so its LaTeX-to-row converter receives real `\frac{...}{...}` instead of collapsed text, and so diagrams travel with the solution in the same order.
- No new solution engine, no per-view generation, no screenshots.

### 4. Ghost / slash artefacts in the diagram
- Stop drawing hidden points as translucent ghost markers in the editor canvas; hidden means not rendered.
- Clear in-progress preview strokes (pending points, drag previews, annotation drafts) whenever the tool changes, selection clears, Escape is pressed, or the scene is committed.
- Make the review halo layer render only while a review session is open, keyed to live object ids so a deleted object cannot leave a halo behind.
- Rendering stays pure React SVG driven by the scene, so a removed object leaves no element behind.

### 5. Regression check (right-angle triangle example)
Solution → Floating → Smartboard must all show: explanation text, `sinθ = 67cm/x` as a stacked fraction, the same geometry diagram with its points, labels, right-angle mark and 60° angle, then `x = 67cm/sin60` as a stacked fraction, in that order. Plus: add/hide/delete a point, delete a text object and move a line, and confirm nothing faint is left behind.

## Technical notes

- `src/lib/lessonnotes/lessonOutline.ts` — `nodeText()` gains a `mathStructure`/`mathSlot` serialiser; `renderSegmentBody()` also emits a structured `nodes[]` stream.
- `src/lib/lessonnotes/syncDocumentToNotebook.ts` — `writeBlocks()` persists `content_json.nodes` alongside `objects`/`content_ascii` (additive, no migration needed since `content_json` is JSON).
- `src/pages/FloatingPreparationPage.tsx`, `src/pages/FloatingNumbersPage.tsx` — read `content_json.nodes` when present (fallback to `content_ascii`); interleave diagram objects in document order via `buildSolutionItems` and render them with `SolutionObjectView`.
- `src/lib/smartboard/presentation.ts` + `src/lib/smartboard/preview/model.ts` — prefer the canonical nodes when building reservoirs/beats so `mirrorFromLessonNote` receives lossless LaTeX.
- `src/components/lessonnotes/GeometryDiagram.tsx` — remove the `ghostHidden` translucent-point branch; halo restricted to ids present in the current scene.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — drop the `ghostHidden` prop, reset preview/pending state on tool change, Escape, commit and deselect.
- No schema change, no UI redesign, no changes to the highlight/marking workflow.
