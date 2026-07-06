I’ll rebuild the placeholder/structure rendering so placeholder color is never controlled by ink color and every structure rule explicitly excludes placeholders.

Plan:
1. Replace the current placeholder palette wiring with a clean resolver
   - Keep one dedicated placeholder color state.
   - Default whiteboard placeholder to `#efece5`.
   - Resolve placeholder color independently from ink and board surface.
   - Add a safe fallback so invalid saved values cannot silently keep the old color.

2. Rewrite `MathTreeRender` placeholder boundaries
   - Rebuild the empty-slot renderer as its own component/function.
   - Structure strokes stay `currentColor` / ink: fraction bars, radical hooks, brackets, digits, exponents.
   - Empty placeholders only use `placeholderColor` for border/background.
   - Any rule that hides, collapses, styles, or measures structure will explicitly say “except placeholder”.

3. Rewrite lesson-note math placeholders in `mathRender`
   - Make `\sl{}` empty slots, unfinished fractions, unfinished square roots, and generated solved-note placeholders use the same placeholder renderer.
   - Remove any inherited `currentColor`, black square glyph, or ink fallback from placeholder paths.
   - Keep filled math content and bars ink-colored.

4. Reconnect the setting to every board render path
   - Board free-writing layer.
   - Solved/lesson-note text on the whiteboard.
   - Manual fraction boxes attached to lines.
   - Live sync snapshot for teacher/student mirroring.
   - Settings preview sample.

5. Clean up old conflicting code
   - Delete old hardcoded placeholder color usage inside renderers.
   - Remove any leftover black/ink dashed placeholder styling.
   - Keep only one placeholder-source module and one placeholder render style.

6. Verify with the exact failure case
   - Open the smartboard route.
   - Insert/show a fraction on the whiteboard from the solved lesson-note flow.
   - Change placeholder color in Settings to a visible color and confirm the boxes change.
   - Change it back to board/cream and confirm placeholders blend with `#efece5` while fraction bars remain black.