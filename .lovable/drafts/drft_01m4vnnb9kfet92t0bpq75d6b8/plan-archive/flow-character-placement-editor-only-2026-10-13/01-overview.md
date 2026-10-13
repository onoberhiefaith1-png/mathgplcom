# Flow character placement — editor only

- Restore a visible drag handle and size slider beside the character in this Game’s Flow preview. Drag to position it; enlarge or shrink it smoothly.
- Synchronize these with the existing Placement controls and save the chosen position and size with this Game.
- Keep one proportional placement across desktop, tablet and phone. Smaller screens may make the minimum adjustment needed to keep the character visible and clear of action buttons, without changing the saved choice.
- During actual play, display the saved placement **without drag or size controls**. Emotion buttons remain usable.

The current scene pins the character to the bottom-right, ignores saved horizontal/vertical values and restricts enlargement inside a short footer. The editor supplies a placement callback that the scene does not use; its Size slider also uses whole-number steps despite a fractional range.