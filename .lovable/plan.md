# Geometry Diagrams + AI Geometry Editor

Two tightly-linked features. The Lesson Note Generator workflow does not change — we only add a new content type (`geometryDiagram`) that the AI emits when a section needs a diagram, plus an AI Edit panel for those diagrams (mirroring the Floating Number AI Editor pattern).

## 1. Diagram data model (single source of truth)

A diagram is a small JSON scene of mathematical objects — not an image, not ASCII, not raw SVG.

```text
GeometryScene {
  bounds: { width, height }              // logical units
  objects: [
    { id, type: "point",   x, y, label?, style? }
    { id, type: "segment", a, b, label?, marks?: "tick"|"double"|"right" }
    { id, type: "line"   , a, b }
    { id, type: "ray"    , a, b }
    { id, type: "circle" , center, r, label? }
    { id, type: "arc"    , center, r, from, to }
    { id, type: "angle"  , vertex, a, b, value?, marker?: "arc"|"right" }
    { id, type: "polygon", points:[ids], fill?, label? }
    { id, type: "label"  , x, y, text }
  ]
  meta: { topic, caption? }
}
```

Renderer: a new `<GeometryDiagram scene=… />` React component renders the scene to inline SVG (clean textbook style: thin strokes, serif labels, angle arcs, tick marks, right-angle squares). Pure function of the JSON, so editing = JSON diff.

## 2. TipTap node: `geometryDiagram`

New extension `src/components/lessonnotes/extensions/GeometryDiagram.tsx`:
- Atom block node with `attrs: { scene: GeometryScene }`.
- `NodeView` renders `<GeometryDiagram>` plus a small toolbar on hover: **AI Edit ✨**, Delete, Resize handle.
- Persists inside `document_json` like other block nodes — no schema migration needed.
- Registered in `DocumentEditor.tsx` extensions array.

## 3. Generator integration (no workflow change)

`supabase/functions/notebook-ai/index.ts` already returns structured section content. We add:

- A new `geometryStandard.ts` knowledge file telling the model: when the concept requires a diagram (circle theorems, tangents, triangles, polygons, angles, transformations, loci, coordinate geometry, etc.), it MUST emit a `geometryDiagram` node with a full `scene` JSON instead of ASCII art. Explicit ban on `/\` / `____` / Unicode box drawing as geometry.
- Extend the output schema (`aiToNodes.ts`) to accept `{ type: "geometryDiagram", scene: … }` and convert it into the TipTap node.
- Tool/structured-output schema mirrors the GeometryScene shape so Gemini can fill it directly (kept small to stay under state limits).
- Post-generation guard: if a section's prose mentions "as shown" / "the diagram" / "the figure" and no `geometryDiagram` was produced, the backend retries once asking specifically for the scene JSON.

Teacher experience is unchanged: pick section → Generate → diagram appears inline, editable.

## 4. Geometry AI Editor panel (mirrors Floating Number AI)

New component `src/components/lessonnotes/GeometryAiPanel.tsx`, opened by the node's **AI Edit** button. Layout matches the existing AssistantPanel:

- Left: lesson note + original diagram remain visible.
- Right panel:
  - **Preview**: live `<GeometryDiagram>` of the proposed scene, with changed objects highlighted.
  - **Chat input** + **mic** (reuses `useVoiceInput` — same hardened hook used by Floating Number AI).
  - **Image upload** (paperclip + camera) — uploaded images sent as multimodal input so the AI can "make my diagram look like this".
  - Buttons: **Apply Changes**, **Regenerate**, **Cancel**.

Edit flow:
1. Teacher types/speaks/uploads ("change 30° to 45°", "make it isosceles", "label A B C", "add a tangent").
2. New edge function `supabase/functions/geometry-edit/index.ts` receives `{ scene, instruction, images? }` and returns a **patched scene** (not a fresh one) using structured output. System prompt enforces: preserve existing object IDs, edit minimally, keep mathematical correctness (e.g. isosceles → adjust only the sides needed).
3. Panel diffs old vs new scene → highlights moved/added/removed objects in the preview.
4. Only on **Apply Changes** does the TipTap node's `scene` attr update.

## 5. Files to add / edit

Add:
- `src/lib/geometry/scene.ts` — types + validators + diff helper.
- `src/lib/geometry/renderSvg.tsx` — pure renderer (angle arcs, tick marks, right-angle squares, labels).
- `src/components/lessonnotes/GeometryDiagram.tsx` — display component + hover toolbar.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — TipTap node + NodeView.
- `src/components/lessonnotes/GeometryAiPanel.tsx` — right-hand AI editor.
- `supabase/functions/notebook-ai/geometryStandard.ts` — generation rules + scene schema description.
- `supabase/functions/geometry-edit/index.ts` — edit endpoint (Lovable AI Gateway, `google/gemini-3-flash-preview`, structured output).

Edit:
- `src/components/lessonnotes/DocumentEditor.tsx` — register the new extension; wire AI Edit panel open state.
- `src/lib/lessonnotes/aiToNodes.ts` — map `geometryDiagram` AI output to the TipTap node.
- `supabase/functions/notebook-ai/index.ts` — inject `GEOMETRY_STANDARD`, add `geometryDiagram` to allowed node types, run the "diagram expected but missing" retry guard.

## 6. Non-goals (explicit)

- No change to lesson note sections, generation buttons, or notebook schema.
- No change to Floating Number AI, Smartboard, or Adventure code paths.
- No raster/image output — diagrams are always SVG built from the scene JSON so they stay editable.

## Out of scope for this plan

- 3D geometry, graph plotting (functions/curves) — would be a separate plan.
- A manual click-to-draw editor — the AI editor + text/voice covers the requested workflow.
