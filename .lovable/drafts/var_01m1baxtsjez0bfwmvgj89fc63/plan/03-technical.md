## Technical detail

### No raw syntax reaches the page

- `supabase/functions/notebook-ai/renderingStandard.ts`: restate the forbidden list as an
  absolute rule — no backslash commands, no `sqrt(`, `x**2`, `a/b` fractions, no markdown.
  Narrow the "allowed template forms" clause so `\frac{}{}` / `\sqrt{}` / `x^{}` / `x_{}`
  are permitted only as a whole maths line, never inside sentence prose (sentences use
  √2, x², π, ×, ÷).
- `supabase/functions/notebook-ai/validator.ts`: add a raw-syntax gate that fails a
  response whose prose lines still contain `\<letters>`, `sqrt(`, `**`, or a stray `^`,
  so the item is regenerated rather than published.
- `src/lib/lessonnotes/aiToNodes.ts`: a sentence containing a backslash command has that
  fragment converted to a `mathInline` run through `normalizeMathSource` /
  `mathDisplayGate` instead of falling through to plain text. Any residual backslash after
  conversion marks the block for regeneration rather than rendering as source.
- Tests in `src/lib/lessonnotes/__tests__/`: `3 + \sqrt{2}` inside a sentence, a lone
  `1 × (3 - \sqrt{2})` line, and `\frac{1}{2}` in prose all produce structured maths and
  zero visible backslashes.

### Question → "Solution" → working

- `src/components/lessonnotes/DocumentEditor.tsx`: keep `solutionPlaceholderNodes()` as
  the single writer of the label; after `generateSolution` commits, assert the section
  contains exactly one Solution heading positioned directly after the question and before
  the first working node, inserting it when the engine omitted it.
- `stripLeadingSolutionLabel` keeps removing a restated label from the body, so the
  heading is never duplicated.
- `src/lib/lessonnotes/copilot/procedure.ts` / `conversation.ts`: every
  `withSolution` item builds question → Solution heading → working, in that order.
- Numbering continues to come from `applyAutoNumbering` (`Example 2` → `Solution 2`).
- Server side: the solution prompt states that the label is supplied by the document and
  the working must start with the first mathematical step.
- Tests assert a generated section's node order and that assessment/practice sections get
  the same treatment as examples.

### Section list contrast

- `src/components/lessonnotes/copilot/BuildProgress.tsx`: item text moves from
  `text-foreground/40` / `text-foreground/80` to `text-foreground` at `text-xs`, the
  header from `text-foreground/40` to `text-muted-foreground`, and the pending icon to a
  visible muted tone. Status stays legible through the icon, not through fading.
- `src/components/lessonnotes/copilot/CoPilotPanel.tsx`: same treatment for its checklist
  rows so the two lists match.
- No colour is hardcoded; semantic tokens only.

### Verification

`bunx tsgo --noEmit`, the lesson-note and math test suites, and an authenticated browser
pass generating a surds lesson: no visible `\sqrt` / `\frac` anywhere, each question
followed by a Solution heading then the working, and the right-hand section list legible.
