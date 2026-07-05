# Delete & Rebuild the Notebook (Teaching Note) Pipeline

## Diagnosis — the fundamental error, found

I checked your saved lesson data for this notebook: **line 4's highlight has NO note saved** (empty), which is why the Presenter Preview correctly shows no note there. That side is honest.

But the Floating Number panel has a **hidden fallback** in its notebook-icon code: when a line has no real note, it silently substitutes the line's "explanation" text — which is parsed out of the raw solution block and, for line 4, is the **entire solution tail (line 4, line 5 … to the end)**. So:

- A phantom notebook icon appears on line 4 even though no note exists.
- Clicking it writes that whole multi-line solution tail onto the board.
- The multi-row write drops the sensor a huge gap below.

There is a second, related leak: the reservoir builder attaches `explanation` to each line using a **positional guess** (`parsedSolution[k]`) when no exact match is found — so wrong-line prose can latch onto any line.

## What gets DELETED (no repair, clean removal)

1. **FloatingNumberPanel.tsx** — the notebook icon's fallback to `lines[activeLineIdx]?.explanation`. Deleted entirely. The icon renders from ONE input only.
2. **PresentationView.tsx** — the inline `notebookFor` function with its ad-hoc purity filter. Deleted from the component.
3. **presentation.ts (buildReservoirs)** — the positional `parsedSolution[k]?.explanation` fallback. Deleted. Explanations may only attach by exact equation match; they never feed the notebook icon.

## What gets BUILT (fresh, one standard)

**New module: `src/lib/smartboard/boardWriter/noteSource.ts`** — the single law for notes, used by BOTH sides:

- `noteForLine(line)` → returns the note **only** from the line's own saved highlight note (`precedingNotebook`). No explanation fallback, no positional guessing, no equation-match guessing.
- Built-in purity check (a note is prose; math-shaped text is rejected) — one implementation instead of copies.
- **Rule: no saved note ⇒ no icon, nothing to write. Ever.**

**Wiring:**
- `PresentationView.tsx` → `notebookText = noteForLine(...)`; note gate uses the same function, so a line without a real note never blocks Next.
- `FloatingNumberPanel.tsx` → renders the notebook icon iff `notebookText` is non-empty. Nothing else can summon it.
- `PresenterPreviewPanel` already reads the highlight's own note — it will call the same `noteSource` so both sides are guaranteed identical (icon on the panel ⇔ note visible in the preview).
- Writing stays on the clean channels you already have (`floatingChannel` / `previewChannel`) — one note click writes only that note's prose, sensor parks right below it.

## Verification

- Regression test: a line whose highlight has an empty note shows NO note on either side and never writes solution text.
- Playwright on this quadratic lesson: line 4 shows no notebook icon; lines with real notes (1, 2, 5, 6…) write exactly their short prose with no sensor gap.
- Full test suite + typecheck.

No backend/data changes — your saved lesson data is correct; only the reading code was lying.