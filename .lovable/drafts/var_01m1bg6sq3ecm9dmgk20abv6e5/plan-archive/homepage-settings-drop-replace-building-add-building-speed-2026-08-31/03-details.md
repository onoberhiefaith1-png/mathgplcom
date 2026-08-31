## Technical detail

Removal
- `src/components/homepage/HomepageSettingsButton.tsx`: drop the Replace Building entry from `OPTIONS`.
- Delete `src/pages/homepage/HomepageReplaceBuildingPage.tsx` and the routes
  `src/routes/homepage/replace-building/index.tsx` and `.../free.tsx`
  (`routeTree.gen.ts` regenerates).
- `src/components/adventure/RotatingAdventureScene.tsx`: stop honouring
  `buildingMode === "custom"` / `customBuilding` so the MathGPL building always
  renders. The `CustomBuildingLayer` code path and its video/speed/loop-fade
  wiring go with it.
- Keep `buildingMode` and `customBuilding` in the `HomepageConfig` type for
  backwards compatibility with rows already saved; nothing writes them anymore.
- `BuildingLibraryModal.tsx` reads `row.config?.customBuilding` — that reference
  is removed so saved library entries only restore slot artwork and speed.

Speed control
- Reuse the existing helpers in `src/lib/homepage/homepageConfig.ts`
  (`clampBuildingSpeed`, `speedToSlider`, `sliderToSpeed`) — no new maths and no
  schema change; `buildingSpeed` is already part of the config.
- `src/pages/homepage/HomepageBuildingPage.tsx`: add local `speed` state seeded
  from `config.buildingSpeed`, mark the page dirty on change, and include
  `buildingSpeed: clampBuildingSpeed(speed)` in the existing `save()` call.
- Speed is read by `RotatingAdventureScene` already, so the homepage picks the
  new value up as soon as it is saved.

Verification
- Typecheck, then load the homepage settings panel and confirm three cards.
- Set a slow speed, save, and confirm the rotation slows on the homepage.
