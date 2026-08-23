# Geometry properties: identity, colour, and Smartboard testing

Goal: a property belongs to one diagram and to the geometry objects it was built from — never to the text that happens to be displayed. Renaming, clearing or recolouring a label must never break a property. No UI redesign; the existing Add Property workflow stays.

## 1. Properties bind to object ids, not typed text

Today the composer keeps `{id, label}` pairs and, on save, keeps only the ids whose label text still appears in the typed expression. That is the text dependency to remove.

- Each pick inserts a **reference token** and records `{token, objectId}` in the property's existing `tokens[]` binding list; the saved links come from those bindings, not from string matching.
- A link is dropped only when the teacher deletes that reference from the expression, not when the label text changes elsewhere.
- The statement is stored exactly as authored. Nothing is ever rearranged to make a clicked part the subject.

## 2. Sensor stays live

Two fixes in the composer:
- Re-picking the same part is currently ignored (a guard remembers the last picked id), which is what forces repeated clicking. Every click inserts, using a click counter instead of an id comparison.
- Picking, adding, clearing, recolouring or renaming never drops editor focus or leaves pick mode; the maths field is re-focused after each insert so typing continues immediately.

## 3. Label is display only; the box is the geometry reference

- A label box gains an owner: the geometry object it names. Clearing the text keeps the box and its owner (`[ BA ]` → `[   ]` → `[ Y ]`), and every property linked to that object keeps working.
- When a label box is selected, a small **×** appears above it. × removes the box and its annotation; deleting text does not.
- Renaming only changes what is displayed. `Y → segment BA` stays true, so the Smartboard still finds the same properties.

## 4. Colour belongs to the object

- Colour is stored per geometry object id in the diagram's property document, so it survives label edits and renames.
- The selection step in the authoring panel gets a small colour picker (e.g. BA blue, BC red, ∠BCA green). Choosing a colour tints the part, its label box, and its highlight.
- On the Smartboard, the reference terms inside a property are drawn in their object's colour, so a student sees at a glance which part each term is.

## 5. One diagram, its own properties

- Properties already travel inside the diagram they were authored on, so Diagram A's properties can never appear under Diagram B. The Smartboard review dock is made to always read the properties of the diagram that was actually clicked, rather than defaulting to the first diagram on the board.
- Clicking a part lists every property containing it: AB → P1 + P2, BC → P1 + P2, CA → P2, ∠BCA → P1.

## 6. Property text for the Smartboard, and a test mode

- A property can carry an extra explanation line intended for the board, saved with it and shown under the statement.
- The authoring workspace gets a **Test on Smartboard** action that opens the real review surface with this diagram only, using the same relationships the live lesson uses: correct diagram, linked properties on click, unchanged formulas, consistent colours, renamed labels still resolving.

## Technical notes

- `src/lib/geometry/properties/model.ts`: keep `tokens: TokenBinding[]` as the authoritative link list; add `colors: Record<GeoId, string>` and an optional `boardText` per item; sanitize/migrate old docs (existing `sourceObjectIds`/`connectedObjectIds` are preserved as a fallback).
- `src/lib/geometry/scene.ts`: add optional `ownerId?: GeoId` to `GeoLabel`; label creation from a selection sets it. Empty `text` is legal.
- `PropertyComposer.tsx`: replace the `statement.includes(label)` filter and the `lastPicked` guard with token bindings plus a pick counter; add the colour picker and the board-text field; refocus after each insert.
- `SelectionInspector.tsx` / `GeometryCanvas.tsx`: the × affordance on a selected owned label box (delete object), text clearing keeps the object, and colour writes to the object colour map plus the rendered stroke/label colour.
- `GeometryDiagram.tsx`: read the colour map when rendering objects, labels and review highlights.
- `ReviewPropertiesPanel.tsx` / `reviewProperties.tsx`: resolve links through `tokens` → object ids, colour the reference terms, render board text, and pin the active diagram to the clicked one.
- Verification: typecheck, then drive the preview through the exact triangle scenario in the request (create both properties, click each part, rename AB → Y, recolour, clear and retype the label, then remove the box with ×).
