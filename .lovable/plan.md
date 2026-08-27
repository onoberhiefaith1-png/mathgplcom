# Fix ∑ / ∏ typesetting and the AI Edit → Accept pipeline

## What is actually in the code today (verified)

- Big operators already exist as real structured objects, in both maths models:
  - the editable tree model has `{ kind: "bigop", op: "sum" | "prod" | "int" | "oint" | "lim", rows: [body, lower, upper] }` (`src/lib/smartboard/mathTree.ts:25`), with a LaTeX parser/serialiser for `\sum \prod \int \oint \lim` including limits (`src/lib/smartboard/mathTreeLatex.ts:48,294`), caret navigation between body/lower/upper (`mathTree.ts:367`), and an editable renderer that already centres the body beside the glyph (`MathTreeRender.tsx:567-599`).
  - the lesson-note document model has a `bigop` `mathStructure` kind with a correct 3-row grid (`src/styles.css:972-976`).
  So no new mathematical representation is needed — this is a rendering-alignment fix plus an Accept-pipeline fix.
- The wrong-looking output comes from the **read-only** renderer used for painted inline maths and for the AI Edit preview: `bigOperatorStack` in `src/lib/notebook/mathRender.ts:398-420` stacks upper/glyph/lower in a column with `verticalAlign: "baseline"` plus a hard `transform: translateY(-0.35em)`. The body that follows sits on the text baseline, so it reads as if it were raised beside the operator — exactly the screenshots. `\int` takes a different ad-hoc branch (`mathRender.ts:775+`), so there is no single rule for large operators.
- AI Edit path: proposal comes from the `notebook-ai` edge function in `runAiEdit` (`DocumentEditor.tsx:2974-2997`); Accept calls `applyAiEdit` (`DocumentEditor.tsx:2999-3084`), which sanitises, compares the captured range against the live document, then either replaces inline with a `mathInline` node, or converts text to nodes via `aiTextToNodes`. `AiEditPanel.handleApply` (`AiEditPanel.tsx:218-230`) already reports failure without touching content.
- `mathInline` stores canonical LaTeX in `value` and a parsed `tree`, and asserts the parse is lossless (`MathInline.tsx:40-60`).

Unconfirmed and therefore step 1 of the work: whether `\sum_{k=1}^{5}(2k^2-k+1)` survives `latexToTree` → `treeToLatex` round-trip. If it does not, the node falls back to showing raw LaTeX, which would explain the unrendered `\sum_{k=1}^{5}(2k^2-k+1)` line in the screenshot. This will be measured before anything is changed, and reported honestly.

## Plan

### 1. Reproduce and measure (no changes yet)
- Round-trip `\sum_{k=1}^{5}(2k^2-k+1)`, `\prod_{n=1}^{4}(n+2)`, `\int_{0}^{1}x^2dx`, `\oint`, and `\coprod` through `latexToTree`/`treeToLatex` and through `renderMathInline`, and record which ones lose structure or fall back to raw text.
- Whatever fails the round-trip gets fixed in the existing parser (`mathTreeLatex.ts`) — not by a new parser.

### 2. One large-operator rule in the read-only renderer
- Replace the `translateY` hack with a single helper used by every large operator (∑, ∏, ∫, ∮, ∐ and any future glyph): a limits stack whose glyph row is aligned to the mathematical axis, so upper limit sits above, lower limit below, and the following body sits beside the operator on the operator's centre line, never looking like a superscript.
- Route `\int`/`\oint` through the same helper (inline convention keeps bounds beside the glyph, display convention above/below), so behaviour is declared per operator rather than hard-coded per call site.
- Limits stay inside the operator's own element so they remain visually attached at any font size.

### 3. Editable renderer parity
- Confirm the editable `bigop` view stays consistent with the read-only view (same axis alignment, same limit sizes), adjusting only alignment values — body/lower/upper slots, caret navigation and click targets stay exactly as they are.

### 4. Accept must commit a valid structure or nothing
Harden `applyAiEdit` into an explicit validate-then-commit sequence:
1. Sanitise the proposal (unchanged).
2. Parse it into the maths model and require a lossless round-trip; a proposal that cannot be represented is rejected with a clear message and the original content is left untouched.
3. Re-verify the captured range still matches the live document (existing guard, kept).
4. Commit in one transaction, writing both `value` and the parsed `tree` on inline maths so the pasted object is immediately editable (today the inline branch writes only `value`, leaving the tree to be re-derived).
5. Report success/failure back to the panel so Accept either closes with the note updated, or keeps the proposal available for a retry — never a half-applied state.
- Because Accept replaces the maths object, changing only the upper limit `5 → 6` keeps the object a `bigop` with its lower limit and body intact and independently editable.

### 5. Regression tests
- Rendering/structure tests: `\sum_{k=1}^{5}(2k^2-k+1)` and `\prod_{n=1}^{4}(n+2)` parse to one `bigop` with the right op, lower `k=1`/`n=1`, upper `5`/`4`, body `(2k^2-k+1)`/`(n+2)`; limits attached; body in the body slot (not an exponent slot); `\int`, `\oint`, `\coprod` covered.
- Accept tests: upper-limit change `5 → 6` and body change `(n+2) → (n+3)` keep the structure and change only the targeted slot; an unrepresentable proposal is rejected and the original document is byte-identical afterwards.
- Existing suites (fractions, radicals, matrices, structural clipboard, Smartboard navigation) must keep passing.
- Browser check of the real note: the ∑ and ∏ lines render with limits above/below and body on the operator's centre line, and an AI Edit upper-limit change appears in the note immediately after Accept.

## Out of scope
No second maths representation, no replacement of the maths editor with text, no changes to Smartboard grading, Floating Numbers, geometry, or the notebook AI prompt contract beyond what Accept validation requires.
