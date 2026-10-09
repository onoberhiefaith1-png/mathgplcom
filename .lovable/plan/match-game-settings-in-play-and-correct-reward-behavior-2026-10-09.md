# Match Game settings in play and correct reward behavior

## Result
- Make the Game use the exact saved Desktop, Tablet, or Phone text size for the device being played. The near-invisible minimum available in Settings will remain the true minimum in play; the player’s optional size control will scale from that saved value rather than replace it.
- Reproduce the first-line duplicate `not`, inspect the composed line before rendering, and remove only the duplicate source so one authored `not` remains. Question text and mathematical notation stay unchanged.
- Keep the Energy Ball’s existing travel into the centre, then rotate there for exactly three seconds and disappear.
- Once any reward activates, hide it for the rest of that saved run. It becomes visible again only after Reset, as requested.
- Add Reward visibility and opacity controls to the Game Settings panel. Visibility is a switch; opacity is a slider from faint/blurred to fully visible. The chosen appearance applies to dormant rewards without weakening their activated effect.
- When a Vault opens, show its encrypted expression first, play the reveal, and only then remove the Vault. A consumed Vault never vanishes before its text has appeared.

## Implementation
- Unify editor preview and `/game/play` around the same saved per-device size resolver and breakpoint mapping. Preserve independent Desktop, Tablet, and Phone values, proportional writing-surface scaling, note sizing, Game tables, and the original Game Pro.
- Remove the conflicting play-only minimum/range behavior and test the saved minimum through the complete editor-save-play rendering path, including the current tablet-sized viewport.
- Trace line 1 through working text, note-only text, and structured display. Add a focused de-duplication guard at the confirmed source rather than globally removing repeated words.
- Keep the Energy Ball centre duration as one authoritative 3000 ms constant and ensure its flight lifetime, target scheduling, rotation, and fade end within that contract.
- Connect the existing saved reward settings to the lightweight Game renderer and expose those controls in its existing right-hand Settings panel.
- Keep consumed reward keys as the authoritative visibility state. Delay Vault consumption/removal until a dedicated expression reveal phase has rendered, while preserving the rule that only the student’s ordered mathematics opens a Vault.

## Verification
- Save distinct Desktop, Tablet, and Phone sizes, including the minimum; reopen Play at each matching viewport and compare the rendered text and writing-surface size with Settings.
- Confirm line 1 renders one `not` and all other repeated words or mathematical symbols remain lossless.
- Time the Energy Ball: centre rotation lasts three seconds, then the ball disappears; activated rewards remain absent across reopening and return only after Reset.
- Check reward visibility/opacity in Settings and Play at faint and fully visible values.
- Open a Vault with its exact encrypted sequence and confirm the text is visible before the Vault disappears.
- Run focused text-size, line-display, Energy Ball, reward persistence, and Vault tests, followed by type checking and the preview build check. No AI generation or AI credits are required.
