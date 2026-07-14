## Goal

Bring the Asset Library (200+ math symbols, elastic structures, parametric diagrams, grids/charts, manipulatives) from the **mathgpl structure** project into this project's Lesson Notes editor, so the teacher can:

- Click the Asset Library button in the editor toolbar to open a full-screen gallery of every asset.
- Type `@` inside the document to summon the inline command menu that searches the same registry and inserts on Enter.

Behaviour, tiles, sections, matrix dialogs, and keyboard flow all match the source project exactly.

## Scope

Only the Lesson Notes editor is touched. Nothing else (rotating academy, adventure games, smartboard, floating numbers) changes.

## What gets copied from `mathgpl structure`

### 1. Asset registry (data)
- `src/lib/lessonnotes/assets/types.ts`
- `src/lib/lessonnotes/assets/registry.ts`
- `src/lib/lessonnotes/assets/insert.ts`
- `src/lib/lessonnotes/assets/symbols.ts`
- `src/lib/lessonnotes/assets/structures.ts`
- `src/lib/lessonnotes/assets/diagrams.ts`
- `src/lib/lessonnotes/assets/graphs.ts`
- `src/lib/lessonnotes/assets/tables.ts`
- `src/lib/lessonnotes/assets/manipulatives.ts`
- `src/lib/lessonnotes/assets/measurement.ts`
- `src/lib/lessonnotes/assets/realworld.ts`

### 2. Structure + matrix support
- `src/lib/lessonnotes/structureValidator.ts`
- `src/lib/lessonnotes/matrixOps.ts`

### 3. New TipTap extensions
- `src/components/lessonnotes/extensions/AtCommand.ts`
- `src/components/lessonnotes/extensions/MathStructure.tsx` (adds `mathStructure` + `mathSlot` nodes)
- `src/components/lessonnotes/extensions/MathVisual.tsx`

### 4. Visuals dispatch tree
- `src/components/lessonnotes/extensions/visuals/visualDispatch.tsx`
- `src/components/lessonnotes/extensions/visuals/arithmetic/**`
- `src/components/lessonnotes/extensions/visuals/circleEngine/**`
- `src/components/lessonnotes/extensions/visuals/coord/**`
- `src/components/lessonnotes/extensions/visuals/lineEngine/**`
- `src/components/lessonnotes/extensions/visuals/living/**`
- `src/components/lessonnotes/extensions/visuals/smarttable/**`
- `src/components/lessonnotes/extensions/visuals/solidEngine/**`
- `src/components/lessonnotes/extensions/visuals/vennEngine/**`

### 5. UI components
- `src/components/lessonnotes/AssetLibraryDialog.tsx`
- `src/components/lessonnotes/AtCommandMenu.tsx`
- `src/components/lessonnotes/MatrixCreateDialog.tsx`
- `src/components/lessonnotes/MatrixToolbar.tsx`

### 6. CSS
Append the `.math-struct`, `.math-slot`, `.math-struct--preview`, matrix bracket, and related rules from the source project's `src/index.css` into this project's `src/index.css`.

## Wire-up inside this project

Edit only `src/components/lessonnotes/DocumentEditor.tsx`:

1. Import `MathStructure`, `MathSlot`, `MathVisual`, `AtCommand`, `AtCommandMenu`, `AssetLibraryDialog`, `MatrixToolbar`.
2. Register `MathSlot`, `MathStructure`, `MathVisual`, `AtCommand.configure({ onChange: setAtState })` in the `useEditor` extensions array — added alongside the existing extensions (SolutionRow, MathObject, MathTable, SmartGraph, SmartCalc, StepAnimation, GeometryDiagram); nothing is removed.
3. Add `atState` + `assetLibOpen` React state.
4. Add a toolbar button (LayoutGrid icon) next to the existing math tools that opens the Asset Library.
5. Mount `<AtCommandMenu editor={editor} state={atState} onClose={...} />` and `<AssetLibraryDialog editor={editor} open={assetLibOpen} onOpenChange={setAssetLibOpen} />` near the editor content.
6. Mount `<MatrixToolbar editor={editor} />` so structural matrix edits work.

No changes to backend, database, storage, edge functions, or any other page.

## Technical notes

- `mathStructure` and `mathSlot` are new inline ProseMirror nodes. They coexist with the existing `mathInline`, `mathBlock`, `solutionRow`, `mathObject`, etc. — TipTap allows multiple inline node types, so nothing conflicts.
- The `@` trigger only fires when preceded by start-of-line or whitespace, so it won't collide with user prose containing `@`.
- Asset tiles that need extra input (matrices, piecewise, systems) open `MatrixCreateDialog` before insertion — same UX as the source.
- Existing lesson-note documents remain valid: no schema migration is needed, the new nodes are additive.
- The visuals tree is self-contained (pure SVG/React) and doesn't depend on anything outside `lessonnotes/`.

## Verification

- `bun run build` succeeds.
- Open a lesson note → new Asset Library button appears in the toolbar → clicking it opens the full-screen gallery with all 5 sections and search.
- Typing `@frac` in the document opens the inline menu; Enter inserts a fraction structure with the caret in the numerator slot.
- Inserting a matrix opens `MatrixCreateDialog`; confirming inserts a matrix and the `MatrixToolbar` appears when it's selected.
- No regressions in existing SolutionRow / GeometryDiagram / SmartGraph flows.

## Out of scope

- Any changes to the rotating academy, adventure games, smartboard, floating numbers, or curriculum data.
- Adding new assets — the port copies the existing 200+ registry as-is.
