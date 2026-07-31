# Highlighted tables not reaching the Generated Floating Numbers page

## What is actually happening

The highlight was saved correctly. The saved highlight for your Smart Table looks like this:

```text
nodeType: "mathVisual"
family:   "diagram"          <-- mislabelled
attrs:    { family: "smarttable", width: 220,
            attrs: { rows: 3, cols: 6, cells: [...], headers: [...] } }
```

Two things break because of that shape:

1. The asset library inserts every table as a generic `mathVisual` node whose real
   identity ("smarttable", "placeValueChart", …) sits in `attrs.family`. The family
   detector only looks at the node type and a few top-level hints, so it classifies
   the node as a **diagram**. The generating page keeps table highlights and skips
   diagram highlights, so the table is dropped before anything renders.
2. Even if it were kept, the grid reader looks for `attrs.cells` / `attrs.rows`,
   but the real grid is nested one level deeper in `attrs.attrs`. It would produce
   no grid and be skipped anyway.

So the table is highlighted and stored, but never recognised as a table.

## The fix

**Recognise asset-library tables.** Teach the family detector to look inside a
`mathVisual` / `mathObject` node's `attrs.family` (and nested `attrs.attrs`) and
match it against the ids in the Tables asset registry, plus the existing
name-contains-"table" rule. Smart table, place-value chart, division ladder,
base conversion and every future entry in the Tables category are then classified
as tables, everything else stays a diagram.

**Read the nested grid.** The grid normaliser unwraps one level of nested `attrs`
before looking for `rows`, `cols`, `cells` and `headers`, so a Smart Table's data
is found regardless of which wrapper stored it.

**Repair already-saved highlights.** Highlights saved before this change carry
`family: "diagram"`. The reader will recompute the family from the node instead of
trusting the stored value, so your existing highlighted table starts working
immediately with no migration and no re-highlighting.

**Label consistency.** With the family corrected, the Highlighting Page control
reads "Highlight this Table" and the generating page shows the table workspace card
(Row/Column orientation, Generate, + Add Line, Retention) in document order.

## Technical notes

- `src/lib/floating/solutionItems.ts` — extend `looksLikeTable` to inspect
  `attrs.family` / `attrs.variant` / nested `attrs.attrs` against the Tables
  registry ids from `src/lib/lessonnotes/assets/tables.ts`; make
  `readSolutionObjects` recompute `family` and `label` rather than trusting the
  persisted values.
- `src/lib/floating/tableGrid.ts` — in `gridFromObject`, merge `obj.attrs` with
  `obj.attrs.attrs` before extracting `rows` / `cols` / `cells` / `headers`.
- No schema change, no data migration, no change to how highlights are saved.
- Verification: reload the current Generated Floating Numbers page for the
  subsection that has the highlighted 3x6 smart table and confirm the table
  workspace card appears with its values (0, -15, 48, 96 …) and generates lines.
