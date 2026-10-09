## Technical details
- `GeometryDiagram.tsx`: `barriersOn` currently = `geometryModeOn && selected` (tiptap NodeSelection). Change to `geometryModeOn && (selected || activeFrameId === instanceId)`.
- On pointer-down of a diagram in 2D mode, call `setActiveFrameId(instanceId)` (from the existing `GeometryModeContext`) in addition to setting the node selection; `stopPropagation` so the editor doesn't immediately reselect text.
- Clear `activeFrameId` when Geometry mode turns off; another diagram's click replaces it. Remove/ignore any "click outside clears active frame" path that fires on toolbox/panel clicks.
- Keep the asset-snapshot / Properties registration keyed to the same active state so the right panel stays bound.
- Verify in the browser: turn on 2D, click an existing diagram, use several tools — lines remain; click another diagram — lines move; turn 2D off — lines gone.
