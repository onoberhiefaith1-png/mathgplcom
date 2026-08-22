# Geometry Properties — render the mathematics, never the syntax

The interaction layer is confirmed working and stays untouched: selecting a diagram opens it,
selecting a side filters the panel, clicking a property highlights its stored object ids.

What I confirmed in the code: the property list prints the stored string as plain text.
`GeometryMapPanel.tsx` renders `{item.relation}` and `{item.principle}` directly, and
`GeometryGuideView.tsx` does the same. Nothing on those two surfaces passes through the
application's math renderer, so a saved `\sqrt{S^2-Z^2}` or `\frac{S}{Y}` is shown character
for character. That is the entire cause — storage and filtering are already correct.

The fix is display-only: every place a property statement becomes visible goes through the
existing `renderMathInline(normalizeMathSource(value))` pipeline already used by lesson-note
lines, the AI Edit preview and Smart Table cells. No second renderer, no schema change,
no change to `objectIds`.
