# Multiple tables in one solution: restore the branching hierarchy

The table branch already exists (a table is folded into one lesson step, its rows/columns form a T-series, and the Smartboard navigates by steps). What is broken is the *hierarchy when more than one table appears in the same solution*: the T-series is numbered lesson-wide instead of per table, table grouping depends on the table's lines being adjacent, and leaving a finished table jumps to the next raw line — which can be another table's internal row. That is what makes multi-table solutions feel flattened.

This change makes the solution an explicit tree with one main path and one hidden branch per table.

## The model

```text
MAIN SOLUTION
├── L1  x² + 2x + 6 = 0
├── L2  x² + 2x = -6
├── L3  (x + 1)² = 7/2
├── T1  ── TABLE 1 ──  T1.1  T1.2  T1.3
├── L4  (x + 1)² = 7/2
├── L5  x + 1 = ±√(7/2)
├── T2  ── TABLE 2 ──  T2.1  T2.2  T2.3  T2.4
├── L6  x = -1 ± √(7/2)
└── T3  ── TABLE 3 ──  T3.1  T3.2
```

- Equation steps carry L-numbers; they are numbered only among themselves, so a table never consumes an L-number.
- Each table is one main-path node numbered T1, T2, T3… in document order.
- A table's children are numbered inside that table only: `T1.1…T1.n`, `T2.1…T2.n`. The child count comes from the table's actual structure — rows when the table is row-oriented, columns when it is column-oriented, using the orientation already stored with the Lesson Note. No new orientation system, no assumption of three children.
- The three tables in the example are unrelated objects with different shapes; nothing is shared between them except the rule "table = one node, children = its internal steps".

## Behaviour

- Closed state: the board and the floating strip show only `L1 L2 L3 T1 L4 L5 T2 L6 T3`. No `T1.1` appears anywhere in the main sequence.
- Opening a table (tapping its T node) expands its children in place; the teacher stays on the same solution, same session, same scroll position — no page change, no reload, no duplicate table.
- Inside a branch, movement steps through that table's children only. The strip shows `T1.2` etc.
- Finishing (or leaving) the branch returns to the **next main node** — `T1 → L4`, `T2 → L6`, `T3 → end`. It never lands on another table's internal row.
- Stepping backward from `L5` reaches `L4`, then `T1`; reopening `T1` restores its existing entries, orientation, retention and child numbering. No second branch is created.
- Tables already placed on the board stay visible; opening/closing only changes which branch owns the counter.

## Technical notes

- `src/lib/smartboard/tableActivity.ts`
  - `buildTableGroups`: group by `table.objId` (first occurrence fixes document order) instead of only merging adjacent lines, so a table whose lines are non-contiguous or highlighted twice stays one branch. Replace the lesson-wide `tStart` with a per-table `tableIndex` (1-based, document order).
  - `tSeriesFor` / `tagForLine`: children become `T{tableIndex}.{pos+1}`; a table's own main node becomes `T{tableIndex}`; every non-table step becomes `L{n}` where `n` counts only non-table steps.
  - `lessonSteps`: unchanged shape, plus a `mainTag` per step and a helper `nextMainStepAfter(group)` that returns the first main-path step following the table — the single authority for branch exit.
- `src/components/smartboard/PresentationView.tsx`
  - Table-complete effect (~line 2879) uses `nextMainStepAfter` instead of `lastMemberIdx + 1`.
  - Counter/tag rendering uses `tagForLine` for both main and branch positions (removes the local `String(activeStepIdx + 1)` fallback) so L/T labels are consistent on the strip, the presenter panel and the evaluation panel.
  - `stepToCounter` / `goNext` / `goPrev` keep operating on steps when outside a branch and on `tSeries` inside a branch; branch exit routes through the same helper.
- `src/pages/FloatingNumbersPage.tsx`: the numbering law block (~line 1117) adopts the same tags — `L{n}` for text lines, `T{k}` for the table card, `T{k}.{i}` for its rows/columns — so preparation and board read identically.
- Lesson Note remains the source: no table is recreated on the Smartboard; grids, orientation, retained cells and values keep coming from the stored `FloatingTableRef`/`grid` snapshot. No schema change and no migration.
- Verification: build a solution with three different tables at different points (3×3 value table, 4-step repeated-division ladder, 2-row place-value table), then confirm the main strip reads `L1 L2 L3 T1 L4 L5 T2 L6 T3`, each table opens to its own child count, and leaving T1/T2 lands exactly on L4/L6.
