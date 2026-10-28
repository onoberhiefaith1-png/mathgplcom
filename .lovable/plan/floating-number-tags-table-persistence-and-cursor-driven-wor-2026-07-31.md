# Floating Number tags, table persistence, and cursor-driven workspaces

Three refinements to the Smart Table / Floating Number model. The architecture stays as it is; what changes is who owns the tag, when the table disappears, and what decides the active workspace.

## 1. Every floating number carries its own tag

Each workspace owns its tag namespace and nothing borrows from the other:

```text
Lesson workspace     Table workspace
Line 1  Tag: 1       T1  Tag: T1
Line 2  Tag: 2       T2  Tag: T2
Line 3  Tag: 3       T3  Tag: T3
```

While the cursor is inside a table, no surface may display a lesson line number for the content being edited. The counter, the chip strip caption, the Presenter Preview highlight, the reasoning/assessment header and the student mirror all read the same tag.

Today the panel counter already switches to `T3`, but the tag shown with the content is still derived from the raw lesson line index (`activeLineIdx + 1`), which is why a table row reads `Tag: 7`. The fix is a single tag resolver instead of several independent derivations.

## 2. Continuous lesson-wide T numbering

T numbers do not restart per table. The first table's rows are T1–T4, the next table continues at T5, the third at T9, and so on, in document order:

```text
Line 1
Line 2
Line 3  Table (Statistics) ── T1 T2 T3 T4
Line 4
Line 5  Table (LCM)        ── T5 T6 T7 T8
Line 6
Line 7  Table (Probability)── T9 T10 T11 T12
Line 8
```

Each table still owns its own branch, entries, orientation and retention; only the numbering is shared.

## 3. The table stays on the board until Delete

Two independent concepts:

- **Active workspace** — lesson floating numbers vs a table's T-series. Decided purely by where the cursor is.
- **Visual table state** — whether the table is drawn on the Smartboard. Changed only by placing the table (its icon) or by Delete / Remove from board.

So: tap the table icon, the table appears. Click a cell, the panel becomes T1…Tn. Click anywhere outside the table, the panel immediately returns to `1 2 3 📋 5 6 7` — and the table is still on screen. It only leaves when the teacher deletes it. Several tables may be on the board at once, each staying where it was placed.

## Technical notes

`src/lib/smartboard/tableActivity.ts`
- Add a T-offset to `buildTableGroups`: each group records `tStart`, the running count of member lines of all previous groups, so `tSeriesFor(group)` emits `T{tStart + i + 1}`.
- Add `tagForLine(steps, groups, lineIdx): string` — returns `T{n}` when the line is a table member, otherwise the lesson step number as a string. This becomes the one tag authority.

`src/components/smartboard/PresentationView.tsx`
- Derive `activeTag = tagForLine(...)` once and use it for the panel counter label, the broadcast snapshot (new `activeTag` field), and any caption passed to the Presenter Preview / reasoning surfaces, replacing local `activeLineIdx + 1` maths for the active line.
- Render **all** placed tables, not just the one owning the active lesson line: map over `placedTables` entries, resolve each `objId` back to its group from `tableGroups`, and render a `TableActivityStage` per placed table at its stored row. Each stage gets its own entries, expand state and sensor cell; `onDelete` removes only that entry.
- Track the table workspace by cursor, not by lesson step: `activeTableObjId` is set when a cell in a placed table is clicked and cleared when the cursor is placed anywhere on the board outside a table (board click / sensor move / lesson chip navigation). Removing a table clears it too. Collapsing or leaving the table's lesson line no longer implies un-placing it, so drop the placement check from the "leaving the table ends the T-series" effect and keep the visibility state untouched.
- `tableSensorCell` becomes per-table (`Record<objId, string|null>`) so two placed tables keep independent cursors.

`src/components/smartboard/FloatingNumberPanel.tsx`
- Accept the resolved tag string and show it in the counter badge and its tooltip (`T3 of 4` inside a table, `Line 7 of 8` outside). The table-icon chip keeps its current behaviour; when a table's T-series is active the chips are the table's rows, each labelled with its own T tag.

`src/components/smartboard/TeacherReasoningPanel.tsx` and the student mirror
- Read the broadcast `activeTag` when present instead of computing `Line {activeLineIdx + 1}`, falling back to the old computation for older payloads.

Unchanged: the Smart Table editor, orientation, retention, cell calculator, validation-in-the-reasoning-engine split, lesson trunk navigation, and the neutral (no ticks) board.
