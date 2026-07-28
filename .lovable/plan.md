## What is happening

Two separate defects, both confirmed in the code.

**1. Generated question lands below the Solution**

When a question section is created, `insertSection` (DocumentEditor) appends a "Solution" H3 + empty paragraph right away. Later, when you press **AI → Generate** on that Example heading, the non-replace branch of `handleSectionAi` does:

```text
insertFrom = info.sectionEndPos      // end of the WHOLE section = after "Solution"
insert questionBodyNodes at insertFrom
insert solutionPlaceholderNodes()    // adds a SECOND "Solution"
```

So the section ends up as **Example → Solution → question → Solution**, which is exactly the screenshot. Two things are wrong: the insert point ignores the Solution heading that already exists, and the placeholder is appended unconditionally.

**2. "Floating numbers not ready"**

The Floating chip resolves a `notebook_subsections` row by position. Those rows are written by the sync layer, whose `splitQuestionBody` ends with:

```text
if (problem || solution) out.push({ problem, solution })
```

An Example whose question and solution are both still empty produces **no subsection row at all**, so the resolver finds nothing and falls back to the "Save the document first" toast. There is nothing to save that would help — an empty question simply never gets a row.

## Fix

### A. Correct the Example → question → Solution order

In `src/components/lessonnotes/DocumentEditor.tsx`, `handleSectionAi`:

- Add a helper that finds, inside the current section, the position of an existing Solution heading (H3 whose text is "Solution" / "Worked solution").
- **Append path:** if a Solution heading exists, insert the generated question body immediately *before* it instead of at `sectionEndPos`, and emit **no** new Solution placeholder. Only sections with no Solution heading get one appended.
- **Regenerate path:** bound the delete range at the existing Solution heading so the question body is replaced while the Solution heading survives; its body is reset to a single empty paragraph (the old solution belongs to the old question). Diagram preservation and re-insertion keep working, still anchored above the Solution heading.
- Apply the same "only if absent" rule in `insertSection`, so a section can never accumulate two Solution headings.

### B. Solution AI never spawns another Solution

- When `info.kind === "solution"`, strip a leading section-label line ("Solution", "Worked solution", "Solution:") from the AI text before it is converted to nodes, so the label is never re-materialised as content.
- The Solution heading's own generate path continues to emit no placeholder (already the case) — with A in place the only Solution heading in a section is the original one.

### C. Floating always opens, blank if empty

Three layers so the toast can never appear:

1. `src/lib/lessonnotes/syncDocumentToNotebook.ts` — a question section always yields at least one subsection. `splitQuestionBody` pushes a pair when a Solution heading was seen even if both sides are empty, and if a question section produced nothing at all it gets one empty `{problem:"", solution:""}`. Reconciliation matches empty-problem subsections positionally (by order index) rather than by normalised text, so an empty row can't be mistaken for a different question or churn ids.
2. `src/components/lessonnotes/extensions/SectionHeading.tsx` — the Floating handler becomes *ensure-then-navigate*: resolve as today; if unresolved, create the owning `notebook_sections` row (if needed) and an empty `notebook_subsections` row with empty `floating_lines` plus empty problem/solution/reasoning blocks at the correct order index, then navigate. The "Floating numbers not ready" toast is removed.
3. `src/pages/FloatingPreparationPage.tsx` — when the solution text is empty, render the page normally with a quiet empty-state line ("No solution content yet — write the solution in the lesson note, then highlight it here") instead of an empty white area. No redirect, no error toast.

The Assign chip keeps its existing behaviour; only Floating gets the ensure path, since that is what you asked for.

## Technical notes

- Ordering fix is purely positional inside `handleSectionAi`; no change to prompts, the question-lock guard, or `getSolutionSource` (which already stops at the closest prior heading and therefore reads the question correctly once the question sits above the Solution).
- The new empty subsection rows are inert: `persistGeneratedExample` already skips floating generation when there is no problem text, and the Smartboard renders empty blocks as nothing.

## Verification

- New Example section → shows Example + Solution. Press AI → Generate: question appears between them, still exactly one Solution.
- Press AI on the Solution heading: solution fills in under the existing heading, no second Solution appears.
- Regenerate the Example: question replaced in place, one Solution heading remains, diagram stays above it.
- Click Floating on a brand-new empty Solution: the floating-prep page opens blank with the empty-state line, no toast.
