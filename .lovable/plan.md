## Plan

1. **Make chart settings one-to-one per inserted chart**
   - Give every `mathVisual` node a stable unique instance id when it renders if one is missing.
   - Pass that id into the SmartChart renderer.
   - Register the right-hand panel with ids like `smartChart:<instanceId>:bar`, `smartChart:<instanceId>:pie`, etc., instead of shared ids like `smartChart-bar` / `smartChart-pie`.
   - This ensures clicking Edit on the third chart edits that exact third chart, not the first chart of that type or the first chart inserted in the lesson.

2. **Clear stale right-panel ownership when a chart edit closes**
   - When SmartChart edit mode is turned off, its registered panel should unregister only if it owns the current panel.
   - This prevents the previous chart’s settings from staying visible and being mistaken for the newly clicked chart.

3. **Fix the disappearing Edit button**
   - Update `SelectionFrame` so the Edit chip remains visible for 10 seconds after the pointer leaves the diagram/chip area.
   - Make hovering the chip itself count as activity, so moving the cursor downward toward Edit does not make it disappear.
   - Keep the chip visible while the asset is selected or its edit panel is open.

4. **Apply the same instance-id pattern to other universal-panel assets touched by this wrapper where needed**
   - SmartChart is the priority, but I’ll make the mechanism generic at the wrapper level so future chart/panel assets can use one-to-one ids safely.

5. **Verify in the live preview**
   - Insert or inspect a sequence like: bar chart → pie chart → bar chart.
   - Click each Edit button and confirm the right panel title/settings match that specific chart.
   - Change a setting on the last chart and confirm only that chart changes.
   - Confirm the Edit chip stays reachable and does not vanish while moving the cursor to it.