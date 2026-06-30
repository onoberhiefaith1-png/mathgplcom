## Floating ↔ Notebook Synchronization Engine

Make the Smartboard's floating-number/notebook pairing exactly match the spec you described. The lesson note becomes the source of truth; the Smartboard mirrors it without rewriting.

### Behaviour rules to enforce

1. **Pairing direction** — every unhighlighted block belongs to the highlight *above* it. Leading unhighlighted prose (before any highlight) becomes a standalone notebook-only entry with no floating number.
2. **No empty notebooks** — a floating number gets `notebook = None` when nothing unhighlighted sits between it and the next highlight. No icon, no glow, no placeholder.
3. **One notebook per gap** — all prose between two highlights collapses into a single notebook entry (even if it's 23 lines). Never split into N notes.
4. **Notebook is a viewport, not generated** — preserve the original lesson-note formatting verbatim: paragraph breaks, blank lines, bullets, numbered lists, indentation, inline math layout, ordering. No flattening to one paragraph, no rewriting.
5. **Glow rule** — notebook icon is calm by default. It glows only after the teacher advances to the next floating number AND the notebook is still unopened. Opening it clears the glow permanently for that lesson line.
6. **Cursor margin** — every new writable line starts at the same fixed left margin (the band's left edge). No drift.
7. **Cursor lock** — the active lesson line is fully editable (left/right caret anywhere); previously locked lines remain read-only (already in place — verify it still holds after the resync).

### Technical changes

**Lesson-note side** (source of truth)
- `src/lib/lessonnotes/syncDocumentToNotebook.ts` and the document → highlight walker: when saving `floating_highlights`, capture each highlight's `precedingNotebook` as a **rich payload** (TipTap JSON fragment of the unhighlighted nodes between the previous highlight and this one), not a flattened `\n`-joined string. Add a `precedingNotebookText` fallback for legacy readers.
- Mark leading-before-first-highlight prose as `notebookOnly: true` and KEEP it as its own entry (do not fold into the first highlight).
- A highlight with no preceding unhighlighted content saves `precedingNotebook: null` — never an empty string that downstream code might treat as "has notebook".

**Presentation builder**
- `src/lib/smartboard/presentation.ts` (the `rawHighlights.reduce` block, lines ~302-331): stop merging `pendingNotebook` into the following highlight. Instead emit a standalone `notebookOnly: true` reservoir line for leading prose. Between-highlight prose still attaches to the highlight *above* (current behaviour for the trailing case — extend so the notebook hangs off line K, not K+1).
- `ReservoirLine.notebook` becomes `notebook?: NotebookContent` where `NotebookContent = { json: TiptapJSON; text: string } | null`. `null` ⇒ no notebook (no icon).
- Drop the `pendingNotebook ? ... : (... || ownNotebook)` fallback — empty string must become `null`, not a truthy "has notebook" signal.

**Smartboard rendering**
- `FloatingNumberPanel.tsx` / notebook checkpoint UI: render notebooks via a small TipTap read-only renderer (reuse the lesson-note renderer) so paragraphs, bullets, math, and blank lines display exactly as authored. Replace the current single-paragraph text node.
- Notebook icon visibility: only render when `line.notebook != null`. Remove any "empty notebook" fallback.
- Glow state machine per `(reservoirIdx, lineIdx)`:
  - `idle` → teacher advances to a line whose previous line has an unopened notebook → `glowing`.
  - `glowing` → teacher opens notebook → `opened` (persist in localStorage so it doesn't re-glow on reload).
  - Remove any continuous pulse animation; glow only fires once per transition.
- Cursor anchor: ensure `bandStart(layout) + k` always resolves to the left margin column 0; remove any per-line indentation that crept in from prose rows.

**Backwards compatibility**
- Legacy notebooks that stored `precedingNotebook` as a plain string still render — wrap them in a single paragraph node at read time.
- Legacy `notebookOnly` rows already exist; keep parsing them but stop folding them forward.

### Files to edit

- `src/lib/smartboard/presentation.ts` — pairing + null-notebook semantics.
- `src/lib/lessonnotes/syncDocumentToNotebook.ts` (+ the highlight walker it calls) — capture rich preceding-notebook JSON.
- `src/components/smartboard/FloatingNumberPanel.tsx` (and the notebook checkpoint component) — TipTap renderer, glow state machine, hide-when-null.
- `src/components/smartboard/PresentationView.tsx` — margin alignment check, glow trigger on lesson-line advance, opened-state persistence key.
- Types: `ReservoirLine.notebook` shape; update any consumers via tsc.

### Acceptance checks

- Solution starts with prose → notebook-only entry appears first, no floating number, sensor parked on next line.
- Solution starts with highlight → first entry is a floating number with `notebook = None`, no icon.
- 23 unhighlighted lines between two highlights → one notebook entry containing 23 formatted lines, attached to the highlight above.
- Three consecutive highlights → three floating numbers, zero notebook icons.
- Bullets / numbered lists / blank lines in a notebook render verbatim, not as a single paragraph.
- Advancing past a line with an unopened notebook makes its icon glow; opening it stops the glow and the icon stays calm across reloads.
- New writable lines all start at the same x-coordinate.

### Out of scope

- Lesson-note authoring UI changes (highlight tool itself is unchanged).
- Floating-number extraction logic, AI assistant, voice input.
- Free-write (non-guided) sessions.
