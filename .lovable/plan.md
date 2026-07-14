# Universal Builders: Tree, Flowchart, Logic/Organisation

Replace fixed tree/flowchart/logic tiles in the Lesson Notes asset library with three intelligent, expandable builders. Each follows the same pattern already used by `circleEngine`, `lineEngine`, `vennEngine`, `solidEngine`: a model stored on the mathVisual node, a canvas, a right-hand panel, and auto-layout.

## 1. Universal Tree Engine (`treeEngine`)

New folder: `src/components/lessonnotes/extensions/visuals/treeEngine/`

Files:
- `types.ts` — `TreeModel { root: TreeNode; direction; defaults }`, `TreeNode { id, label, prob, expr, color, size, children, branchStyle }`, `BranchStyle { length, angle, thickness, arrow, label, prob }`.
- `presets.ts` — `buildTreePreset("tree2" | "tree3" | "treeBlank")` seeds levels × branches.
- `layout.ts` — Reingold–Tilford-style walker computing non-overlapping x/y per node from `direction` (TB / LR / Radial) plus per-node subtree width. Guarantees no overlap when branches added/removed.
- `TreeEngineCanvas.tsx` — SVG canvas, click-to-select node/branch, "+" affordance on selected node adds child, "×" deletes and re-layouts. Reveal toggle hides subtrees for classroom drip-reveal.
- `TreeEnginePanel.tsx` — right rail (matches Venn/Circle panel styling): Levels stepper, Branches-per-node stepper (applies to selected node or globally), Node section (Label / Probability / Expression / Colour / Size), Branch section (Length / Angle / Thickness / Arrow / Label / Probability), Add-Branch / Delete-Branch / Duplicate / Reveal-Next.
- `TreeEngineNode.tsx` — tiptap wrapper mirroring `VennEngineNode`.

Registry: in `src/lib/lessonnotes/assets/diagrams.ts` replace `tree2` / `tree3` with a single tile `V("tree", "Tree diagram", "treeEngine", "Logic & Organisation", ["tree","probability","branch"], { preset: "tree2" })`.

## 2. Universal Flowchart Engine (`flowchartEngine`)

New folder: `src/components/lessonnotes/extensions/visuals/flowchartEngine/`

Files:
- `types.ts` — `FlowModel { nodes: FlowNode[]; edges: FlowEdge[]; layout }`. `FlowNode { id, kind: "process"|"decision"|"io"|"connector"|"start"|"end"|"comment", x, y, w, h, text, fill, border, radius, align }`. `FlowEdge { from, to, style: "straight"|"orthogonal"|"curved", arrow, label }`.
- `presets.ts` — `buildFlowPreset("flowBlank")` returns a single Start node.
- `layout.ts` — auto-align engine with modes `horizontal | vertical | tree | radial | free`; only `free` disables auto-layout.
- `routing.ts` — edge routing (straight / right-angle / curved) recomputed whenever endpoints move so lines stay connected.
- `FlowchartEngineCanvas.tsx` — drag shapes, drag-from-port to another shape to create edge, marquee select, resize handles, snap grid.
- `FlowchartEnginePanel.tsx` — Insert palette (Process / Decision / Input-Output / Connector / Start / End / Arrow / Comment), per-shape edit (Text / Resize / Border / Fill / Radius / Alignment / Duplicate / Delete), Layout selector, edge style selector.
- `FlowchartEngineNode.tsx` — tiptap wrapper.

Registry: replace `flowchart` tile with `V("flowchart", "Flowchart", "flowchartEngine", "Logic & Organisation", ["flow","algorithm","decision"], { preset: "flowBlank" })`.

## 3. Universal Logic & Organisation Engine (`orgEngine`)

New folder: `src/components/lessonnotes/extensions/visuals/orgEngine/`

Handles hierarchy, classification, mind map, org chart, logic map, relationship map, concept map — one model, different layouts.

Files:
- `types.ts` — `OrgModel { root; direction: "TB"|"BT"|"LR"|"RL"|"radial"|"free"; edgeDefaults }`. `OrgNode { id, text, color, border, shape: "rect"|"roundedRect"|"circle"|"diamond"|"hexagon"|"customSvg", children, collapsed }`. `OrgEdge { style: straight|curved, arrow: none|single|double, dash: solid|dashed, label }`.
- `presets.ts` — `buildOrgPreset("mindmap" | "hierarchy" | "concept")`.
- `layout.ts` — reuses the tree walker; radial mode wraps around root; free mode keeps stored coords.
- `OrgEngineCanvas.tsx` — click node for actions (Add Child / Delete / Duplicate / Collapse / Expand). Auto-repositions on every mutation.
- `OrgEnginePanel.tsx` — Node (Text / Colour / Border / Shape picker) / Connection (Straight / Curved / Arrow / Double / Dashed / Label) / Layout selector.
- `OrgEngineNode.tsx` — tiptap wrapper.

Registry: keep a single tile `V("orgDiagram", "Logic / organisation diagram", "orgEngine", "Logic & Organisation", ["hierarchy","mindmap","concept","org","classification","relationship"], { preset: "mindmap" })`. Drop redundant fixed tiles.

## Wiring

- `src/components/lessonnotes/extensions/visuals/visualDispatch.tsx` — add three new family branches `treeEngine`, `flowchartEngine`, `orgEngine` returning their respective `*EngineNode`, mirroring how `circleEngine` / `vennEngine` are wired today.
- `MathVisual.tsx` needs no changes — dispatch is data-driven.
- No DB migration: models live inside the existing `attrs` blob on the `mathVisual` node.

## Shared conventions

- Panel styling and open/close behaviour copied from `VennEnginePanel` for visual consistency.
- All auto-layout runs on every mutation; `free` mode is opt-in.
- Reveal / collapse state stored on the node (`revealDepth`, `collapsed`), so classroom drip-reveal survives save/reload.
- Existing documents remain valid — the three retired tiles (`tree2`, `tree3`, `flowchart`) map to the new engines via `preset` on open, so old notes still render.

## Out of scope

Adventure games, smartboard, floating numbers, curriculum data, and every other lesson-note tool are untouched.
