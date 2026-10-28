## Changes

1. **Save links exactly as they are.** When a relationship is saved, every side or angle link keeps its real ID. Underscores inside a link are never turned into subscripts.
2. **Repair notes that are already saved.** When a Geometry Map is opened, any damaged link (`s_{C}A`) is matched back to the real object (`s_CA`). This fixes this note without asking you to retype it.
3. **Clean up every display.** The link-hiding step will work even when a link contains braces. Every place that shows Geometry Properties will show only classroom maths: the editing panel, the Smartboard and the student view ("How this was solved").
4. **Keep the title and the equation apart.** The title becomes a short principle name. If the title is empty or just copies the equation, it is replaced with a name worked out from the equation (for example, a² = b² + c² gives "Pythagoras' theorem"). The teacher can rename it. The equation appears only once.
5. **Warn about missing squares.** If one side of a Pythagoras-style relationship is squared and the other side isn't, the teacher sees a gentle note before saving: "Did you mean CA²?". Nothing is changed automatically.

## Technical details

- In `GeometryMapPanel` and `PropertyComposer` save paths (`treeToLatex` → `normalizeMathSource`), put a placeholder in each `\georef{id}{label}` before normalising and restore it afterwards.
- Add `repairGeoRefIds(doc, scene)` in `map/model.ts`. It strips `{}` from IDs and matches them to `scene.objects`, then fixes `relation`, `principle`, `tokens` and `objectIds` in `readMap`.
- Change the `GEOREF` regex in `renderStatement.tsx` to allow one level of nested braces in the ID.
- Add `derivePrincipleTitle(relation)`, used when `principle` is empty or matches `relation`.
- Add tests for the damaged link ID, Pythagoras display with no raw syntax, title not duplicating the equation, and the missing-square warning.
