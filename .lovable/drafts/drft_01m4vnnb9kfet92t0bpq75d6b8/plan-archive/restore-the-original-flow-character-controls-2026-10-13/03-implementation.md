## Technical approach
- Mount the existing `DraggableResizable` around the Game character, using its parent-frame coordinate mode and original subject controls.
- Adapt existing Game percentage coordinates to the Flow wrapper’s fractional coordinates without changing shared Flow records or introducing device-specific placements.
- Use the same base size and proportional position model for editing and play. Remove the new bar and the snapping/shrinking character geometry; keep result-layout behavior unrelated to character placement unchanged.
- Align the existing Placement size control with the original 0.3–10× range so both controls reflect the same value.
- Preserve original Lesson Note Flow behavior, Game Pro, mathematics, rewards, scoring and progression. No database changes or publishing.

## Acceptance checks
1. Test free two-axis coordinate updates, proportional restoration and sizing above 2.5× up to 10× without hidden shrinking.
2. In this signed-in Game, show the original move/−/+ controls, drag down and diagonally, then enlarge well beyond the previous maximum.
3. Save and reopen, read back position/size, and compare desktop, tablet and phone views. Restore pre-test settings after verification.
4. Verify normal play shows no placement controls and keeps action buttons clickable. Exercise completion/failure/pause when a playable run is available.
5. Run focused tests and inspect preview health. Report live-player or installed-offline verification as pending if those flows cannot be reached.