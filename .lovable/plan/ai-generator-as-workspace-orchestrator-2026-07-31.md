# AI Generator as Workspace Orchestrator

Today the AI Generator returns one blob of marked-up text (`supabase/functions/notebook-ai/index.ts` → `aiTextToNodes`), so a "frequency table" or "sphere" arrives as typed characters rather than a real Smart Table or 3D object. This plan turns the generator into an orchestrator that must first reach for an existing platform tool, and only writes plain text when nothing fits.

## 1. Workspace Tool Manifest (single source of truth)

A new `src/lib/lessonnotes/ai/toolManifest.ts` builds, at runtime, the complete list of things the AI is allowed to use:

- Every entry in the existing asset registry (`src/lib/lessonnotes/assets/registry.ts`) — symbols, structures, diagrams, graphs, tables, manipulatives, measurement, real-world.
- Every editor node type that represents a workspace tool: `mathTable` (Smart Table), `smartGraph`, `geometryDiagram` (2D), `scene3dDiagram` (3D), `smartCalc`, `mathStructure`, `mathVisual`, `stepAnimation`.
- Floating Number workflow (orientation, generate, retention) as a post-processing action.

Because the manifest is derived from the registry and the extension list, **any tool added later is automatically available to the AI with no redesign** — the future-proof rule in the spec.

## 2. AI returns directives, not just prose

The `notebook-ai` edge function gains a compact directive syntax the model must use whenever a tool exists (the manifest, condensed, is injected into the system prompt with a strict priority order: Asset Library → Smart Table → Graph → Diagram/3D → Calculator → manual text).

Example of what the model emits for "Generate a lesson on Mean Deviation":

```text
Mean deviation measures the average distance of each value from the mean.
[[tool:smartTable template=statistics cols=x,|x-x̄| rows=6,7,10,12,13,8,12]]
[[tool:mathStructure kind=fraction slots=Σ|x−x̄|,N]]
```

Each directive names a manifest id plus parameters. Anything with no matching tool stays plain text — the fallback rule, unchanged.

## 3. Materializer turns directives into real editable objects

`src/lib/lessonnotes/ai/materializeDirectives.ts` sits between the AI response and the document:

1. Parse directives out of the response stream.
2. Resolve each against the manifest (exact id first, then the registry's existing fuzzy search — the "search the Asset Library before creating" step).
3. Insert via the **existing** insertion paths (`insertAsset`, and the same node specs the toolbar buttons use), then populate: table cells, graph equations/series, diagram labels, 3D dimensions and labels.
4. Unresolved directive → degrade to the plain-text line the model also supplied, never a broken node.

Result: every AI-produced object is the same editable node a teacher would have created by hand, with the same Properties Panel behaviour.

## 4. Server-side validation

A new `workspaceStandard.ts` in the edge function enforces the priority order the same way the existing standards files do: if the response contains a hand-typed ASCII table, a text-drawn shape, or a manually typed graph description while a matching tool exists in the manifest, the response is rejected and regenerated as a tool directive. Existing standards (QUESTION_LOCK, pedagogy, inheritance, output hygiene) are untouched and run after materialization as they do now.

## 5. Floating Number awareness

When the request implies an activity ("turn this table into a Floating Number activity"), the materializer inserts the Smart Table, then runs the existing Table Workspace pipeline (generate → orientation → retention) so the activity is prepared without the teacher navigating there.

## Technical notes

- Files added: `src/lib/lessonnotes/ai/toolManifest.ts`, `src/lib/lessonnotes/ai/materializeDirectives.ts`, `supabase/functions/notebook-ai/workspaceStandard.ts`.
- Files edited: `supabase/functions/notebook-ai/index.ts` (manifest injection + validation hook), `src/lib/lessonnotes/aiToNodes.ts` (directive-aware pass before text tokenizing), `src/components/lessonnotes/AiPopover.tsx` and `AiEditPanel.tsx` (route responses through the materializer).
- No changes to the Main Lesson Note editor layout, Smartboard, Game Editor, or existing node schemas — the AI reuses the insertion APIs those tools already expose.
- Rollout order: manifest → directive parsing/materializing for Smart Table + Graph → Diagram/3D + Asset Library reuse → Calculator + Floating Numbers → server-side enforcement.
