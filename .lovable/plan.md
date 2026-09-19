# Vault system — Floating Numbers owns the hidden method reward

Only the Vault system will change. The Game world, surfaces, camera, timers, Life, Bombs, Collectors, Completion, AI marking, HUD styling, and other reward behavior stay unchanged.

## Confirmed current foundation

- The reference image’s Vault already exists: the gold-ended, blue horizontal cylinder with closed and open artwork.
- The 3D Game already has the original Vault animation: the cylinder opens, the hidden mathematical expression rises into view, the effect resolves, and the reward is collected.
- Vault is already excluded from the normal add-reward picker, but old Game-side Vault editing still remains and will be removed.
- Vault data is currently stored in the Game’s per-line settings with a ten-Vault limit. It must instead belong to each saved Floating Numbers line, with no fixed limit.
- Current matching uses mathematical equivalence. Vault needs ordered, consecutive method-sequence matching instead, while normal AI equivalence remains untouched.

## 1. Move Vault authoring to Floating Numbers

Replace the obsolete `fraction, bracket…` entry area beneath each teacher Floating Numbers line with a dedicated **VAULT** area:

- **+ Add Vault** creates a new expression for that exact line.
- Each entry is labelled Vault 1, Vault 2, and so on.
- The teacher can add, edit, delete, and reorder entries.
- There is no fixed maximum.
- Expressions render as mathematics and support the structures Floating Numbers already supports, including fractions, powers, roots, brackets, operators, and relations.
- Saving or autosaving Floating Numbers saves the Vault entries with that line. Reloading restores them exactly.

The teacher sees the mathematical expression here, not the physical cylinder.

## 2. Make the Floating Numbers line the source of truth

Extend each saved Floating Numbers line with its ordered Vault expressions, keyed by the existing permanent line ID.

- Game Line N reads the Vault entries directly from Floating Numbers Line N.
- Editing or deleting a Vault on the Floating Numbers page is reflected the next time the Game loads; no stale Game copy remains.
- Attaching a question continues to store only the question reference.
- Existing Game-side Vault data is migrated into the matching Floating Numbers line once when possible, so previously entered teacher work is not silently lost.
- Remove the Game Questions panel’s Vault Code editor, reward amount field, ten-item limit, and legacy manual Vault controls.
- Keep Vault absent from the general Game Rewards picker.

## 3. Create physical Vaults automatically in Play

For every non-empty Vault entry on a Floating Numbers line, create one derived `math-vault` reward on the corresponding Game writing surface.

- Zero entries means zero Vault cylinders.
- Two entries means exactly two cylinders.
- Any number of entries creates the same number of cylinders.
- Use stable per-entry IDs so each Vault keeps its own collection state across progress saves.
- The student sees only the existing sealed gold/blue cylinder and its encrypted glyph treatment before activation.
- The teacher’s expression is never printed on the writing surface or exposed in the student Floating Numbers controls.

## 4. Match the teacher’s exact consecutive mathematical sequence

Build Vault matching from the existing structured mathematical token pipeline, not raw HTML, pixels, or loose character search.

- Normalize harmless notation differences while preserving token order, operators, signs, relations, and structure.
- Search for the complete Vault token sequence as a consecutive subsequence of the student’s current work on that same line.
- `x + 7` matches inside `x + 7 = 12`.
- `x + 7` does not match `x = 12 − 7`, even if AI accepts that method as mathematically correct.
- `x + 7` and `7 = 12` may both match inside `x + 7 = 12`; matching one does not consume shared tokens.
- Matching is continuous as the student constructs the line through the existing Mobile Floating Numbers interface.
- AI marking remains a separate correctness/equivalence system and is not changed.

## 5. Preserve the original Vault reveal and collection behavior

Use the current `math-vault` artwork, open artwork, 3D renderer, sounds, glow, and reveal effect without redesign:

```text
sealed cylinder
→ exact sequence detected
→ cylinder activates and opens
→ hidden mathematical expression rises into view
→ Vault resolves/disappears
→ VAULT counter increases by 1
```

- No padlock, chest, substitute icon, or new Vault artwork.
- A Vault is collected once per Game attempt.
- Runtime state follows Locked → Matched → Revealing → Collected, without allowing a click to bypass mathematical matching.
- The HUD keeps its current layout and styling, but its Vault indicator uses the existing Vault visual language instead of a generic padlock icon.
- Vault count remains independent of Completion, Life, timers, and marks.

## 6. Persistence and Reset

- Persist each collected Vault by its question, line, and Vault entry ID.
- Returning to an in-progress Game restores already collected Vaults and the counter without exposing hidden expressions.
- **Reset** clears collected/reveal states and returns the Vault counter to zero for the new attempt.
- Reset never deletes or changes the teacher’s saved Vault expressions.

## Technical details

- Add ordered Vault entries to the existing `FloatingLine` JSON stored with the lesson-note question; no separate global Vault collection.
- Remove Vault ownership from `LineSurfaceConfig`, retaining a compatibility reader only for one-time migration of legacy Game-side entries.
- Replace the current equivalence-based `vaultMatches` behavior with structure-aware consecutive token matching.
- Keep derived Vault generation in the Game line mapper, now reading the referenced Floating Numbers line’s Vault entries.
- Prevent direct player clicks, Bombs, or Collectors from awarding a still-locked Vault; only its sequence match starts the existing Vault effect.

## Verification

1. On the current Floating Numbers question `x + 7 = 12`, create Vault 1 `x + 7` and Vault 2 `7 = 12`; save and reload to confirm both remain on Line 1.
2. Attach/open the question in Game Play and confirm Line 1 contains exactly two sealed instances of the reference cylinder, with no expression visible.
3. Construct `x + 7`; confirm only Vault 1 opens, reveals `x + 7`, resolves, and VAULT becomes 1.
4. Continue to `x + 7 = 12`; confirm Vault 2 opens and VAULT becomes 2, without re-awarding Vault 1.
5. Reset, construct `x = 12 − 7`, and confirm both Vaults remain sealed even if normal AI marking accepts the mathematics.
6. Confirm overlapping sequences can unlock independently, line-specific Vaults never cross lines, unlimited entries persist, and edit/delete/reorder changes appear on the next Game load.
7. Confirm Vault is absent from Game reward settings and no existing non-Vault Game behavior changed.
