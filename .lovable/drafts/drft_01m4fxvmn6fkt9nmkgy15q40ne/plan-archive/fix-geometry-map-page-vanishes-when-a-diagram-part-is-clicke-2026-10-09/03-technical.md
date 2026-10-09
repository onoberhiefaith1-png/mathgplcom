## Technical notes
- `PropertyComposer.tsx`: the pick subscription depends on `scene`, and `onAutoColor` mutates the scene, so the listener re-subscribes on every click. Read the scene through a ref, subscribe once per `picking`, and make `onAutoColor` a no-op when the object already has a colour. Guard the `onHighlight` effect against identical id lists.
- `GeometryPropertiesWorkspace.tsx` / `GeometryDiagram.tsx`: make sure scene writes from the workspace don't remount the node view that owns the overlay (keep the open state outside the node view or keyed by diagram id). Wrap the workspace in an error boundary.
- `GeometryMapPanel.tsx` relink subscription: apply the same ref pattern.
- Verify with Playwright on `/lesson-notes/a403e855-...`; no database changes.
