# Plan — Move "Highlight → Enter" to the Generating page (revert it on the Highlighting page)

I had put the Enter workflow on the wrong page. This plan moves it to the right one.

- **Highlighting page** = `src/pages/FloatingPreparationPage.tsx` — the page that opens when the teacher first clicks "Generate Floating Numbers". This page goes back to exactly how it was before (no Enter button, no green pending-selection state).
- **Generating page** = `src/pages/FloatingNumbersPage.tsx` — the page reached after the highlight step, where the per-line equations and the empty fillers row are shown next to the AI Edit / Generate buttons. The Enter workflow lives here.

The AI "Generate" button stays on the Generating page so teachers who want AI can still use it. Manual highlight→Enter is an alternative the teacher can use line-by-line instead of (or after) AI Generate.

---

## What the teacher does on the Generating page

For each equation line shown in `FloatingWorkspace`:

1. Teacher highlights any span inside the rendered equation (e.g. `9x²`, `+22x`, `(x+2)`, `²`).
2. While a selection exists on that line, an **Enter** button next to AI Edit becomes active; pressing the **Enter** key also fires it.
3. On commit, the highlighted text becomes one filler chip appended to that line's fillers row, and any structure detected from the highlight is added to that line's containers row as an empty shell.
4. Selection clears. Teacher highlights the next piece, presses Enter, and so on until the fillers row for that line is complete.

Nothing about AI Generate, AI Edit, Shuffle, scoring, or persistence changes. The new commit just calls the existing `onChange` path that AI Generate already uses to populate `fillers` and `containers`.

---

## Structural awareness (same intent as before, applied per highlight)

The teacher can either highlight the structure themselves or leave it adjacent to the atom. Detection is local to the highlighted line's plain text.

| What the teacher highlights | What happens |
|---|---|
| Whole structure incl. body (`9x²`, `(x+2)`, `2^{x+5}`, `√(x+1)`, `f(x)`) | One chip emitted verbatim. The container kind (`power`, `bracket`, `radical`, `function`…) is added to the line's containers row. |
| Just the atom, with `^` immediately after (`2` then `^x`) | Chip = `2`, plus a `□^{□}` empty shell added to containers. Body (`x`) stays on the equation line for the teacher to highlight next. |
| Just the atom, with `_` immediately after | Chip = atom, `□_{□}` added to containers. |
| `f` / `θ` / single letter / `sin` / `cos` / `log` followed by `(` | Chip = the letter, `(□)` shell added to containers. |
| `√` alone | Chip = `√(□)`, radical added to containers. |
| `d/dx`, `∂/∂x` | Chip = `d/dx(□)`, derivative added to containers. |
| Inside `|…|` | Chip = `|sel|`, absolute added to containers. |
| Brackets: highlighting one bracket alone is rejected with a toast — brackets are never single. Teacher must highlight the matching pair (the system finds the partner automatically when only one is highlighted and extends the selection). |
| Anything else | Chip = highlighted text verbatim, no container added. |

All chips pass through the existing `toUnicodeMath` / `isStillDirty` normalizer so they render in classroom style (`²`, `√`, `□`…), exactly like AI-generated chips do today.

---

## Files

- `src/pages/FloatingPreparationPage.tsx` — **revert** the Enter button, the pending-selection green state, the keyboard handler, and the pending-payload preview row. Selection behaviour returns to the original immediate-commit highlight flow.
- `src/components/lessonnotes/FloatingWorkspace.tsx` — add a small per-line Enter button next to AI Edit; capture the teacher's text selection inside the rendered equation; on commit call the existing `onChange` with `{ fillers: [...prev, chip], containers: mergeStructures(prev, detected) }`.
- `src/lib/smartboard/manualFloatingPromoter.ts` — keep the file, but the public function now also returns the detected container kind (`power`, `bracket`, `radical`, …) so the workspace can update the containers row. No backend changes.
- `src/test/manualFloatingPromoter.test.ts` — extend existing cases to assert the returned container kind, and add the "single bracket gets expanded to the matching pair" case.

No changes to: backend edge functions, AI prompts, DB schema, routes, the highlighting page, or any other page.
