# Diagrams as note content: from Solution to Floating page to Smartboard

A 2D/3D diagram inside a Solution is Notes-layer content: it can never be highlighted or become a floating number. Today it stops at the Highlighting Page — it is shown there for context, but nothing carries it onward, so it never reaches the Floating Number page and never reaches the note icon on the Smartboard.

This change makes the diagram travel with the note it belongs to.

## The rule

A diagram behaves exactly like unhighlighted prose:

```text
[ highlighted line ]        -> floating number
  unhighlighted words       -> its note
  DIAGRAM                   -> part of that same note
```

- A diagram is attached to the highlight ABOVE it, joining any unhighlighted prose there in one note.
- A diagram before the first highlight becomes a standalone note entry (no floating number), the same way leading prose already does.
- Tables keep their choice: highlight = workspace, no highlight = note. Diagrams have no choice — always note, never highlightable.

## What changes on each page

**Highlighting Page** — unchanged behaviour, plus the diagram is now recorded as note content on the highlight above it (still no checkbox, still labelled as notes content).

**Floating Number page** — each diagram appears in document order, inside the note of its owning floating line, rendered live and read-only. It cannot be turned into a chip, workspace, or numbered line, and it cannot be deleted from the sequence — it is lesson content. Lines that only carry a diagram show as a note-only row.

**Smartboard** — a line whose note holds a diagram shows the note icon. Pressing it writes the note as it does today, with the diagram rendered at classroom scale beneath its prose. A diagram-only note still gets an icon.

## Technical notes

- `src/lib/floating/solutionItems.ts`: diagrams gain an explicit "note attachment" role; add a helper that assigns each non-floatable object to the highlight above it.
- `src/pages/FloatingPreparationPage.tsx`: in `orderedHighlights` / `saveHighlightState`, write diagrams into the owning highlight as `noteObjects: SolutionObject[]` (and create a leading notebook-only entry when a diagram precedes the first highlight). No schema change — `floating_highlights` is JSON.
- `src/pages/FloatingNumbersPage.tsx`: stop silently dropping non-floatable objects; read `noteObjects` per highlight, render them read-only with `SolutionObjectView` inside the line's note area, and persist them on the matching `floating_lines` row.
- `src/lib/lessonnotes/floatingCompile.ts`: `FloatingLine` gains `noteObjects?`.
- `src/lib/smartboard/presentation.ts`: the highlight filter at the reservoir builder currently keeps only `object.family === "table"`; keep diagrams out of floating lines but carry their `noteObjects` onto `ReservoirLine.notebook`'s sibling field `noteObjects`.
- `src/lib/smartboard/boardWriter/noteSource.ts` + `src/lib/smartboard/preview/model.ts`: `TeacherNote` gains `objects`; a note exists when text OR objects exist (note-purity for text is unchanged).
- `src/components/smartboard/PresentationView.tsx`, `FloatingNumberPanel.tsx`, `PresenterPreviewPanel.tsx`: note icon condition includes objects; note rendering appends `SolutionObjectView` with `presentation` styling.
- Backwards compatible: notes saved before this change have no `noteObjects` and behave exactly as today.
- Verification: a solution with a highlighted equation, unhighlighted prose and a 2D circle diagram — confirm the diagram shows on the Floating page under its line with no highlight control, then open the Smartboard, press the note icon on that line and confirm the diagram renders with the prose.
