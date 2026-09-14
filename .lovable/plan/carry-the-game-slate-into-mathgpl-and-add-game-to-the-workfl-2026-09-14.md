# Carry the Game Slate into MathGPL and add GAME to the workflow

Two things only: bring the existing Slate Artisan across exactly as it is, and put **Game** into the core workflow between **Classes** and **Adventure**.

## 1. Carry the Game Slate across, unchanged

Copy the Slate Artisan project files into MathGPL under their own namespaces so nothing existing is touched:

- `src/components/slate/*`, `src/components/slate/text3d/*` → same paths (new folder)
- `src/components/world/*` (Slate's 3D world: RoomShell, SlateColumn, WorldStage, Effects, WorldBoundary, materials, pbr, textures, sections) → copied to `src/components/gameslate/world/*` to avoid colliding with MathGPL's existing 3D building code
- `src/lib/slate/*` → same path (defaults, environments, layout, pbr, rewards, rooms, storage, surfaces, text3d, types)
- `src/types/troika-three-text.d.ts`
- Images: `src/assets/slate/{backgrounds,surfaces,rewards}` (real .jpg/.png files, copied directly)
- The two page bodies (gallery + editor) become `src/pages/game/GameSlateGalleryPage.tsx` and `src/pages/game/GameSlateEditorPage.tsx`, with their JSX, styling and behaviour unchanged; only the internal navigation targets are re-pointed at the MathGPL routes below.

Its saved games keep using the same browser storage key (`game-slate:games`), so no database work at this stage.

Nothing in the Slate's UI, surfaces, writing system, rewards, timer, effects, Edit & Settings or visual identity is redesigned.

## 2. Routes

- `/game` → the Game Slate gallery ("Create game" + saved games), exactly as its current home page
- `/game/slate/$gameId` → the Game Slate editor/play view

`/game/$slug` (public Smart Card game) already exists; the static `/game` and `/game/slate/...` segments take priority over it, so Smart Card links keep working. Both new routes get their own page titles/descriptions.

## 3. Add GAME to the workflow everywhere

Insert Game directly after Classes and before Adventure, using the existing item design and icon set (`Gamepad2`):

- `src/components/workspace/workspaceNav.ts` — Teacher group and Shared-Teacher group left-hand navigation
- `src/lib/workspace/quickActions.ts` — the quick-access workflow buttons (and update its existing order test)
- Student workspace navigation gets the same Game entry in the same position, pointing at `/game`
- Class dashboard already has a **Games** tile; it is left as it is and no duplicate is added

The resulting order everywhere: Lesson Notes → SmartBoard → Classes → **Game** → Adventure → Courses.

## Technical notes

- **Dependencies to add:** `troika-three-text` (Slate's 3D inscribed text) and `@types/three`. `three`, `@react-three/fiber` and `@react-three/drei` are already installed; MathGPL is on `three ^0.170` while the Slate was authored against `^0.186`. Plan is to keep MathGPL's version and verify the Slate renders; if a real incompatibility appears, raise `three` and re-check the existing building scenes.
- **Asset pointers:** the Slate's 39 PBR/HDR files are project-scoped `*.asset.json` pointers that do not resolve here. Each will be downloaded from the source project's own preview origin and re-uploaded into this project, keeping the same `src/assets/.../*.asset.json` filenames so `src/lib/slate/pbr.ts` keeps working untouched. If any single file cannot be fetched, that will be reported rather than silently substituted.
- **Fonts/CSS:** the Slate's typography (`DM Serif Display` / `Fira Sans`) and its scoped styles are added as a Game-Slate-only stylesheet plus a root `<link>` font load, so MathGPL's global design tokens and existing pages are unchanged.
- **Entitlements:** the Game quick action reuses the existing Adventure feature gate, so no plan/feature-catalogue migration is needed at this stage. A new `nav_game` label key is added to the translation catalogues.
- Lesson Notes, Smartboard, Classes, Adventure and Courses behaviour is not modified. No Floating Numbers or maths-engine wiring in this stage.

## Verification

Typecheck, the existing quick-action/nav tests, and loading `/game` plus a created game in `/game/slate/$gameId` in the preview to confirm the Slate renders and behaves as in the original project.
