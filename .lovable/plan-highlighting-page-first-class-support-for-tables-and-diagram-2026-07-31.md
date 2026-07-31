# Highlighting Page: first-class support for tables and diagrams

Today the Highlighting Page can only see plain text and equations. When a lesson note is saved, the solution is flattened to text lines (`renderBody` in `syncDocumentToNotebook.ts` keeps paragraphs, headings and math only), so every table, chart, geometry diagram, 3D scene and other asset node produces an empty string and disappears before the Highlighting Page ever loads. That is why tables and diagrams cannot be highlighted.

This update makes the solution stream carry objects as well as text, and gives each object a one-click highlight control.

## 1. Keep objects when the note is saved

The solution is re-parsed into an ordered stream of items instead of a flat block of lines:

```text
[ text ] [ text ] [ OBJECT ] [ text ] [ OBJECT ] [ text ]
```

- Text items keep exactly today's behaviour and are still written to `content_ascii`, so nothing that already works changes.
- Object items store the node's type and full attributes in the solution block's existing `content_json` column (no migration needed).
- An object is defined generically: any node in the solution that is not text, paragraph, heading or inline/block math. There is no allow-list of table or diagram types, so every current asset and every future asset is captured automatically.
- Each object gets a stable reference (`<nodeType>#<n>`, its ordinal among objects of that type in the solution) so its highlight state survives re-saving the note.

## 2. Render objects on the Highlighting Page

The page loads the item stream and renders it in document order on the same notebook paper:

- Text runs render as today, word-by-word, with drag-to-highlight unchanged.
- Object items render as a card containing the real, live object — drawn with the same renderers the lesson note uses, in read-only mode. A Smart Table shows as a table, a geometry diagram as a diagram, a 3D scene as a 3D scene. Nothing is turned into a picture or a text approximation.
- Objects are labelled by family: a table object shows "Table", anything else shows "Diagram", and an unrecognised future asset falls back to "Object". The family is inferred from the node, not from a fixed catalogue, so the nine statistical tables, the number-base, logarithm, number-theory, financial, measurement, algebra, coordinate, probability and truth tables all arrive as tables without being listed anywhere.

## 3. One-click highlight

Above each object card sits a single control:

```text
[ ] Highlight this Table          [ ] Highlight this Diagram
```

- Default is unhighlighted, for every table and every diagram.
- One click highlights the whole object — all rows, columns and cells at once. No cell-by-cell or row-by-row selection.
- Clicking again returns it to unhighlighted.
- The card shows a clear highlighted state (yellow frame + filled checkbox) matching how highlighted text looks.
- Undo, Redo, Clear and autosave all cover object highlights the same way they cover text highlights.

## 4. Mixed notes

Text, equations, tables and diagrams coexist in one solution, each keeping its own highlight state, in the order they appear in the note. Object cards break the surrounding text into separate runs, so an unhighlighted paragraph before a highlighted table stays a note and the table stays its own object.

## 5. Handover to Floating Numbers

Highlighted objects are saved alongside text highlights in `floating_highlights`, in document order, each tagged as an object with its type and attributes. The Generate Floating Numbers page and the Smartboard presentation reader are updated to skip object entries safely for now, so nothing downstream breaks. Row/column sequencing for highlighted tables is a later piece of work, as requested.

## Technical notes

- Files touched: `src/lib/lessonnotes/syncDocumentToNotebook.ts` (item-stream parse + `content_json` write), a new `src/lib/floating/solutionItems.ts` (item types, object family/label inference, restore helpers), a new read-only object renderer component under `src/components/lessonnotes/`, `src/pages/FloatingPreparationPage.tsx` (item rendering, object cards, highlight toggle, history and save), plus defensive skips in `src/pages/FloatingNumbersPage.tsx` and `src/lib/smartboard/presentation.ts`.
- No schema change: `notebook_blocks.content_json` and `notebook_subsections.floating_highlights` already exist.
- Backwards compatible: solutions saved before this change have no `content_json`, so they render exactly as they do today, and existing token highlights restore unchanged.
- Heavy objects (3D scenes, WebGL canvases) keep their click-to-activate behaviour on the Highlighting Page so a note with many objects cannot exhaust the browser's WebGL contexts.
- Verification: a note containing a paragraph, an equation, a Smart Table, another paragraph and a geometry diagram — highlight the equation by dragging, highlight the table and the diagram with one click each, reload the page and confirm all three states persist and the two objects still render live.
