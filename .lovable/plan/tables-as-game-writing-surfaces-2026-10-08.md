# Tables as Game Writing Surfaces

## Goal
A Smartboard table joins the Game as ONE writing surface. Inside it, students get exactly the Smartboard table behaviour (cells, Subcells, Floating Numbers, Calculate, working above the blue line, answer below). The Game only adds coins, marks, Vaults and progress on top. No second table system.

## What the student sees
1. Normal surfaces stay exactly as they are. When a question contains a table, its lines collapse into one large writing surface showing the whole table.
2. Tapping a normal cell gives the usual Row/Column Floating Numbers. Tapping a Subcell gives that Subcell's Floating Numbers, same as the Smartboard.
3. Pressing Calculate (or completing the working) checks it with the existing marking engine. A correct answer appears under the line, and the working stays above.
4. Each calculated Subcell carries a small Completion Coin. Raw data cells (such as X = 5) carry no coin and no marks.
5. A correct Subcell awards its coin and unlocks its marks. Copying numbers into data cells alone earns nothing.
6. A Subcell can hold a Vault. Its working stays hidden until the student opens it. The student then solves it, and the coin and marks follow.
7. The table surface shows progress such as "5 of 8 calculations". When every calculated Subcell is done, the surface counts as complete and the Game moves on as usual.

## What the teacher sets (Game editor)
- Selecting the table surface lists its calculated Subcells. Each one gets marks (default 1), a coin (on by default) and an optional Vault.
- The preview uses the real table display, so the teacher sees what the student will see.

## Not changing
Smartboard table behaviour, Floating Numbers, normal writing surfaces, marking and equivalence, the existing Vault rules for normal lines, assignments, Levels and Academia.

## Technical details
- Grouping: table member lines (`FloatingLine.table.objId`) become one Game surface record, keyed by the table's objId. This reuses the `tableGroup` grouping from `src/lib/smartboard/presentation.ts`. Line numbering for the other surfaces is unchanged.
- Rendering: the Game mounts the same interactive `TableActivityStage` (plus `MathCellEditor`) on the table surface, inside the existing content-driven surface size rules. A `mode="game"` prop only adds coin, Vault and lock overlays per Subcell key.
- State: Subcell entries, active Subcell and completions are saved in the Game attempt state, so a reload resumes where the student stopped.
- Config: `LineSurfaceConfig` gains an optional `tableCells: Record<subKey, { marks, coin, vault? }>` in `src/lib/slate/types.ts` and `lineSurfaces.ts`. The defaults come from `deriveSubcells` (every calculated Subcell gets 1 mark and a coin). Older saved Games load unchanged.
- Rewards: a Subcell completion sends coins and marks through the existing reward gate (`rewards.ts`, `useGameRuntime.ts`), which needs full marks. A Subcell Vault reuses the existing Vault animation and exact-sequence matching against the Subcell's expected working.
- Tests: grouping (a table becomes one surface), default coins and marks (data cells get none), awarding (a correct Subcell gives a coin once, a wrong one gives nothing), surface completion, and save/reload.
