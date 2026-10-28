## Technical detail

Empty fraction bar
- New repair step ahead of conversion (used by `aiTextToNodes` in
  `src/lib/lessonnotes/aiToNodes.ts` and by `analyzeProblem`): map stray control
  characters back to their macro names, only when the following letters complete a
  known macro (form feed + `rac` → `\frac`, backspace + `inom` → `\binom`,
  vertical tab + `ec` → `\vec`), so `\frac{140}{2}` survives transport.
- `src/lib/notebook/mathDisplayGate.ts`: `assertDisplaySafe` gains a
  `mode: "generated" | "editing"`. In `generated` mode an unbalanced `\frac` /
  `\sqrt` is dropped (with its consumed operands) instead of emitting
  `\frac{\sl{}}{\sl{}}`; `editing` keeps today's empty-slot behaviour for the
  Smartboard/manual typing paths.
- `mathRender`/`aiToNodes` never create a `mathInline` whose normalized value is
  only empty slots — such a run is discarded.
- Tests: `\x0crac{140}{2}` renders a real stacked fraction; a truncated
  `\frac{140}{` in generated text leaves no visible bar and no leaked digits.

Objects instead of markup
- Classifier in `aiToNodes.ts`: a `\begin{pmatrix|bmatrix|matrix|array}` block
  becomes a `matrix` node (existing matrix object), a pipe/tab table block or a
  `Table:`-led block becomes a `mathTable`-shaped node with editable cells, and a
  question whose blueprint sets `diagramRequired` keeps its diagram node from the
  existing geometry pipeline (`pipeline/generate.ts` already gates one diagram per
  question).
- `supabase/functions/notebook-ai/renderingStandard.ts`: state the emission
  contract for the three object kinds — matrices only inside a matrix
  environment, tables as one row per line with a fixed column separator, figures
  described through the diagram spec — and forbid flattened/ASCII substitutes.
- Server validator gains rules rejecting an ASCII-art table and a matrix written
  as a tuple list.

Inventory contrast
- `src/components/lessonnotes/copilot/BuildProgress.tsx` and the `StepRow` in
  `CoPilotPanel.tsx` switch the label ink from `text-foreground` to the panel's
  own solid dark ink (as used by the surrounding `text-slate-900/700` copy), so
  the checklist stays black on the light panel under either theme.

Training sweep
- Run the ten notes through the live Co-Pilot in an authenticated browser session,
  screenshot each, and check the list in the overview. Fix each defect in the
  standards/converters, redeploy `notebook-ai`, and re-run the affected topics.
- Verification: `bunx tsgo --noEmit`, the lesson-note/math Vitest suites plus new
  cases above, and the screenshots for the ten notes.
