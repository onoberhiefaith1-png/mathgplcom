# Structural copy & paste for mathematical objects

Copying a matrix (or any structure) in Lesson Notes must move the mathematical **object**, not its digits. Paste must recreate a real 2x2 matrix with four independently editable cells and intact brackets.

## What is wrong today

Two confirmed causes:

1. The selection toolbar's **Copy** and **Cut** buttons write plain text only — `navigator.clipboard.writeText(snapshot.text)`. The structural slice is captured in the snapshot but thrown away, so a copied matrix arrives as `2134`.
2. Nothing normalises the selection to structure boundaries. Dragging across a matrix produces a partial selection that starts/ends inside cells, so even a structural paste would arrive as loose cell fragments rather than one matrix.

The editor itself already stores maths structurally (one `mathStructure` node with `kind`/`attrs` and one `mathSlot` per cell), and those nodes already have HTML write/read rules — so the fix is to actually use them on the clipboard, not to build a new editor or a new format.

## What will change

**1. Structural clipboard payload**

A small clipboard helper serialises the selected slice using the editor's own schema serialiser and writes **two** flavours to the clipboard:

- rich flavour: the structural markup (`data-math-structure`, `data-kind`, `data-attrs`, one `data-math-slot` per cell) — this is what paste reads back;
- plain-text flavour: the readable value, so pasting into other apps still works.

Paste inside the note prefers the rich flavour, so the structure is rebuilt exactly: brackets, rows, columns, cell contents, nesting.

**2. Whole-object selection boundaries**

Before copy/cut/duplicate, the selection is expanded outward to the edges of any mathematical structure it touches. Selecting part of a matrix copies the whole matrix; selecting a square root that contains a fraction copies the entire nested hierarchy. A selection that contains no maths is unaffected.

**3. Keyboard copy/cut use the same path**

Ctrl/Cmd-C and Ctrl/Cmd-X are handled with the same boundary expansion and the same payload, so toolbar and keyboard behave identically.

**4. Paste handling**

A paste handler on the notes editor detects our structural markup and inserts it as nodes at the caret. Anything else (ordinary text, ChatGPT paste, HTML from elsewhere) keeps its current behaviour untouched.

## Scope guard

- No change to how structures render, validate, or are edited.
- No change to the Smartboard, Floating Numbers, the maths tree, or the AI pipelines.
- `NoteReader`, slide blocks, and the solution object view are untouched.
- Geometry diagrams keep their existing "one authoritative diagram per question" rule on duplicate/paste.

## Technical details

- New `src/lib/lessonnotes/structuralClipboard.ts`:
  - `expandSelectionToStructures(state, from, to)` — walks ancestors of both ends and grows the range to enclosing `mathStructure` nodes (recursively, so nested structures return the outermost boundary).
  - `sliceToClipboard(editor, from, to)` — `DOMSerializer.fromSchema(schema).serializeSlice(...)`, wrapped so ProseMirror's own slice metadata survives; returns `{ html, text }`.
  - `writeStructuralClipboard({html, text})` — `navigator.clipboard.write` with `ClipboardItem` (`text/html` + `text/plain`), falling back to a hidden-`copy`-event path when `ClipboardItem` is unavailable.
  - `structuralHtmlToSlice(editor, html)` — parses back through the schema for the paste path.
- `SelectionToolbar.tsx`: `captureSnapshot` applies the expansion; `copy`/`cut`/`duplicate` use the structural payload.
- `DocumentEditor.tsx` `editorProps`: add `handlePaste` (prefer structural HTML) and `handleDOMEvents.copy`/`cut` for keyboard parity. `transformPastedHTML` is left alone.
- Existing `mathStructureValidator` plugin still runs after paste and will canonicalise any shape it does not recognise — cell text is preserved, so a well-formed paste passes through unchanged.
- Tests in `src/lib/lessonnotes/__tests__/structuralClipboard.test.ts`: round-trip 2x2 and 3x2 matrices (bracket attrs, slot count, per-cell text), fraction, `sqrt(y/6)`, fraction inside a radical, power/superscript, and boundary expansion from a partial in-cell selection.

## Acceptance

Matrix 2x2 with 2, 1, 3, 4 copied from Solution and pasted into Example remains a 2x2 matrix with four separately editable cells; fraction and `sqrt(y/6)` keep their nesting; nothing pastes as `2134`; existing editing behaviour unchanged.
