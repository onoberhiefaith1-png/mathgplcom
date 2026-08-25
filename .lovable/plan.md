# Replace Building: remove background + building speed

Two additions to the Replace Building editor.

## 1. Remove background (on the building itself)

A **Remove background** button sits with the building actions, under the preview next to "Upload building" and "Choose building from Asset Library" — the same real cutout used on Edit MathGPL Building, not the chroma-key toggle already in the settings panel.

- Enabled once a building image is loaded; disabled for video buildings (a video keeps the existing chroma-key "Remove background" switch in settings).
- Clicking it processes the building currently on the preview, then swaps the preview to the transparent version. Shows "Removing…" while working, with a toast on success or failure.
- The homepage keeps its current building until **Save Building** is pressed, as today.

## 2. Building speed (in the settings panel)

A **Speed** slider is added to the Building settings panel, under Transform.

```text
0.1x ..... 0.5x ..... 1x (middle) ..... 5x ..... 10x
   slower              normal                 faster
```

- Range 0.1 to 10, default 1, with 1 sitting at the centre of the track (left half maps 0.1→1, right half 1→10).
- Quick presets: 0.1x, 0.25x, 0.5x, 1x, 2x, 5x, 10x, plus a live "Speed (1.0x)" readout.
- What it drives: for a video building, the video's playback rate; for the rotating MathGPL building, the rotation rate. So the same control means "how fast the building moves" in both modes.
- Saved with the building (Save Building) and applied on the homepage.

## Technical notes

- `src/lib/homepage/homepageConfig.ts`: add `buildingSpeed?: number` to the config type (default 1, clamped 0.1–10). Stored in the existing `profiles.homepage_config` JSON — no migration needed.
- `src/pages/homepage/HomepageReplaceBuildingPage.tsx`: add the cutout flow reusing `makeTransparent` (`src/lib/games/removeBackground.ts`), `getSignedUrl`/`resolveMediaUrl`, and `uploadGameAsset` + `renderPathOf` — fetch current building URL → File → `makeTransparent` → upload as `background` kind PNG → `setBuilding(makeBuilding(...))`. Own `cutting` state so it doesn't clash with `busy`.
- Speed UI: rendered in the editor's aside beside `SettingsPanel` (keeps the shared game-builder panel untouched), with a log-ish two-segment mapping so 1 lands mid-track. `apply()` saves `{ buildingMode: "custom", customBuilding: building, buildingSpeed: speed }`.
- `src/components/adventure/RotatingAdventureScene.tsx`: `CustomBuilding` sets `playbackRate` on its video element from `config.buildingSpeed`; the 3D path multiplies `ringSpeed` by the same value in the existing `targetSpeed` calculation (hover/pause behaviour unchanged).
- No geometry, slot, or advertisement changes.
