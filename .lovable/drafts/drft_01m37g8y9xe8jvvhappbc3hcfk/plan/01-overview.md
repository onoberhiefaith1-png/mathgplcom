# Make text placement survive the full Game lifecycle

## Confirmed cause

The correct visual position already exists, but it is not the saved source of truth.

- The renderer calculates an emergency correction when measured text falls outside its surface, but that correction lives only in temporary screen state and is explicitly cleared when the question, text, size, surface, width, height, or restore key changes.
- Play reconstructs each displayed line from a saved pattern slot. That recreates the old saved placement after a level change, reload, resize, or fresh Play session.
- The current **Text** action in the editor saves a default anchor rather than the exact measured correction. In Play it changes only the temporary displayed Game and never repairs the saved Game.
- The Game record stores slots and their `textConfig` in the backend. The affected Game currently has centred `ax: 0.5, ay: 0` pattern positions, so there is a real persisted placement to validate rather than a missing database field.

## Result

One surface-relative placement contract will control Edit, Preview, teacher Play and student Play. Every rendered text body will be measured against its own current writing surface, corrected deterministically when necessary, and prevented from returning to an invalid saved position.

The existing **Text** control will remain separate from Reset and become the manual safety net for the same automatic fit operation; no duplicate reset-style control will be added.
