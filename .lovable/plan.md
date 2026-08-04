# Compress the video adventure editor chrome to 20%

The toolbar area above the canvas currently eats about half the screen. The goal: everything shown by default fits in roughly 20% of the height, leaving 80% for the video editing canvas. "Show toolbar" is what expands beyond that.

## What changes

### 1. Smaller, denser toolbar text and buttons
In the action row (Video Adventure, Video Background, Background, Reward, Progress Bar, Add Effect, Questions, Set Camera Target, Settings, Layers):
- Buttons drop to a compact height (h-7) with `text-[11px]`, tighter padding, and `h-3.5 w-3.5` icons with a 1-unit gap.
- Row padding drops from `py-2` to `py-1`, gaps from `gap-2` to `gap-1.5`, and the row stays on one line where it fits.

### 2. Slimmer timeline strip
In the checkpoint timeline (Play, 0:30 / 1:55, Set Start, Change Video, Remove):
- Same compact button/text treatment; play button becomes a 7-unit square.
- Scrubber height reduced from `h-7` to `h-4`; vertical spacing from `space-y-2` to `space-y-1.5`.
- Checkpoint chips shrink to `text-[10px]`.

### 3. Move the per-checkpoint detail form into the expandable area
The Name / Loop start / Loop end / Timer panel is the biggest single block. In the collapsed (default) state it is hidden; the active checkpoint's range still shows on its chip. It appears when "Show toolbar" is expanded, together with the header row that already lives behind that toggle. This is what keeps the default chrome inside 20% while letting the expanded state go further.

### 4. Keep the fold bar minimal
The full-width Show/Hide toolbar bar stays where it is, with slightly reduced height so the collapsed chrome is: fold bar + one action row + one timeline row + chips.

## Technical notes
- `src/pages/GameEditorPage.tsx`: compact classes on the action-row buttons; pass the existing `topBarOpen` state down to `CheckpointTimeline` as a `expanded` prop.
- `src/components/gamebuilder/CheckpointTimeline.tsx`: compact sizing; gate the active-checkpoint settings block on the new `expanded` prop.
- Presentation only — no changes to checkpoint data, loop logic, or the staged engine.
