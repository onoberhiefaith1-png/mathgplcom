# Technical approach

**New node kind, not a text convention.** `src/lib/smartboard/mathTree.ts` gains
`{ kind: "georef"; objectId: GeoId; rows: [Row] }` beside the existing `box` node (which already
proves the single-slot outlined-cell pattern). `mkGeoRef(objectId, label)` seeds `rows[0]` with the
picked label's characters. `subRowsOf` treats it like any other one-row node, so caret movement,
nesting, selection and undo work with no navigation changes.

**Serialization.** `src/lib/smartboard/mathTreeLatex.ts` round-trips it as
`\georef{<objectId>}{<label latex>}`. Because it is a real macro with braced arguments, the stored
statement carries identity, and an empty label serializes as `\georef{s_17}{}` — identity survives
a cleared label.

**Editing surface.** `MathInlineCanvas.tsx` renders a georef row as an outlined rounded cell filled
with the object's colour (read through `objectColor`, passed in via a new optional
`refColorOf?: (objectId) => string | undefined` prop) plus a × button on focus/hover that removes
the node via the existing delete/apply path. No new editor instance and no separate chip row.

**Composer.** `PropertyComposer.tsx` stops calling `request({ text: label })` and stops the
`refs` + `statement.includes(label)` reconciliation. `objectIds` and `tokens` are derived by walking
the tree for `georef` nodes, so a deleted box drops its link and a renamed label never does.
`ComposedProperty.tokens` keeps its shape for storage compatibility, with `token` recorded as the
current label snapshot (display only, never used for lookup).

**Model.** `src/lib/geometry/map/model.ts`: `COLOR_SEQUENCE` becomes the six-colour order
(`#0f172a`, `#2563eb`, `#e11d48`, `#7c3aed`, `#059669`, `#d97706`) and `OBJECT_COLORS` is renamed to
match (Black, Blue, Red, Purple, Green, Orange). `autoColorObject` / `colorCursor` semantics already
satisfy the "manual override does not advance the sequence" rule and stay as they are. A new
`geoRefsInStatement(statement)` helper parses `\georef{...}{...}` for readers.

**Rendering everywhere.** `src/lib/geometry/map/renderTokens.tsx` gains a georef-aware path: split
the statement on `\georef` macros, render each label through the shared `MathText` inside a span
coloured by `objectColor(doc, objectId)`, and render the remainder as ink. The current
longest-text-match branch is kept only as the legacy fallback for statements without georefs.
`GeometryMapPanel.tsx`, `ReviewPropertiesPanel.tsx` and `SmartboardPropertyTest.tsx` render through
this one helper, so panel, board and test agree by construction.

**Diagram.** `GeometryDiagram.tsx` already paints objects and owned labels from
`readMap(scene).colors` keyed by `GeoId`, and highlights from `item.objectIds` — unchanged. Object
lists for "all properties on this object" use the existing `itemsForObject`, wired into the review
panel's object click so it shows every match rather than one.

**Storage.** No schema change: everything continues to live in `scene.meta.geometryMap`
(`items[].objectIds`, `items[].tokens`, `colors`, `colorCursor`).

**Verification.** Typecheck, then drive the preview through the ten-step test: pick EF (black),
ED (blue), an angle (red), recolour ED green, pick a fourth object and confirm purple, clear the EF
label, type `Y`, confirm every property still resolves to segment E–F, then open the Smartboard and
confirm identical colours and highlights.
