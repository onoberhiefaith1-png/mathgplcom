## Technical approach
- Wire editor-only pointer dragging and a nearby size slider to the existing Game-only placement settings.
- Share pure proportional placement geometry between preview and player, with visibility and action-clearance constraints. Remove the footer-only enlargement restriction and use fractional size steps.
- Apply the same placement to uploaded characters and the offline fallback. Preserve shared Lesson Note Flows, Game Pro, mathematics, rewards, scoring and progression.
- Use the existing Save action. No database changes or publishing.

## Verification
1. Add tests for proportional position/size, screen bounds and action clearance across desktop, tablet and phone.
2. In this signed-in Game’s Flow editor, drag, enlarge, Save and reopen; confirm the saved position and size return.
3. Switch tablet/phone sizes and confirm placement remains consistent, the character stays visible and action buttons remain clear.
4. Check actual completion, failure and paused views: the saved placement displays, no editing controls appear, and dragging cannot alter it.
5. Check relevant tests and available build signals. Clearly report any offline or actual-device checks that remain unverified.