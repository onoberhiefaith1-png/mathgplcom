# Remove Background per Building Image

Add a **Remove background** action to every one of the 16 artwork cards on Edit MathGPL Building, so a newly uploaded image (which still shows its own backdrop) can be made transparent and blend with the original artwork.

## What changes for you

- Each image card gets a small **Remove background** button at the top of the card, next to the "Replaced"/label row.
- Clicking it processes the image currently shown in that slot, then updates the thumbnail and the 3D homepage building with the transparent version.
- While working, the button shows "Removing…" and is disabled; a toast confirms success or reports failure.
- Original artwork slots (never replaced) can also be cleaned, but they are already transparent, so the button only appears for slots that have a replaced image.
- Revert (the circular arrow) still restores the original artwork.

## Technical notes

- File: `src/pages/homepage/HomepageBuildingPage.tsx` (UI only).
- Reuse existing pieces: `makeTransparent` from `src/lib/games/removeBackground.ts` (in-browser `@imgly/background-removal`), `getSignedUrl` from `src/lib/games/urls.ts`, and `uploadGameAsset` / `renderPathOf` from `src/lib/games/assets.ts`.
- Flow on click: resolve the slot's current URL → `fetch` it into a `Blob` → wrap as a `File` → `makeTransparent` → `uploadGameAsset(file, "background", "<slot> artwork (cutout)")` → `save({ slotOverrides: { ...overrides, [slotId]: ref } })` with `mediaType: "image"`.
- Note: `uploadGameAsset` only auto-cuts transparency for `reward`/`progress_bar`/`effect` kinds, so the cutout is produced client-side before upload and uploaded as an already-transparent PNG; the stored path then feeds the existing slot-override texture pipeline unchanged.
- Busy state tracked with a second `useState` (`cutoutSlot`) so it does not clash with the existing `busySlot` upload state.
- No schema, scene, or geometry changes; slot position/curve/perspective/rotation stay untouched.
