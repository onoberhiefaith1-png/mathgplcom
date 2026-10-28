# Game save fix — 1 GB backgrounds and a Save that always tells the truth

The teacher's game background is currently rejected twice over: the app refuses any upload over 12 MB, and the save button then shows a generic "the background may be too large" message that hides the real reason. This plan raises the background limit to 1 GB (1000 MB) and makes Save either succeed or say exactly why it did not.

## What changes

### 1. Allow uploads up to 1 GB

- Raise the Slate asset upload cap in `src/lib/slate/assets.ts` from 12 MB to 1000 MB (1 GB), with an updated plain-language error ("That file is too large (1 GB maximum).").
- Add a database migration that sets the `game-assets` storage bucket's per-file limit to 1 GB (`file_size_limit = 1073741824`), so the backend accepts what the app now allows.

### 2. Save always stores the background as an uploaded file

- On Save, if the background is still a temporary in-browser copy (data/blob URL from an older game), upload it to the account's storage first and keep only its storage path in the saved game — the saved game row stays small, so the row itself can never be "too large".
- The same guarantee already holds for music and sun images; saving verifies the background reference is a storage path before writing.

### 3. Save tells the truth

- Replace the generic "Could not save — the background may be too large" toast with the real result from `saveGameResult`: signed-out, permission, or the exact backend message.
- Saving shows a "Saving…" state and the button is disabled while it runs, so one click = one complete save; success confirms "Game saved to your account."
- No change to what is saved: the complete stage design, surfaces, text style, effects, rewards, and Hourglass/Vault settings already save as one game — this only removes the failures.

## Verification

1. Upload a background larger than 12 MB (up to 1 GB) in the Game editor — accepted, and visible in Edit.
2. Press Save — success message appears; reopen the game and refresh: the background, surfaces, text style, effects, and rewards all return exactly.
3. Open Play: the same background renders for the student.
4. Force a failure (signed-out session) and confirm the toast names the real cause instead of guessing.
5. Run the slate/game test suites and typecheck.

## Not changing

No changes to gameplay, the Floating Numbers panel, rewards, timers, or the visual design. Only the upload ceiling, the bucket limit, and the save error handling move.
