# Rebuild the Game with the upgraded Slate Art

Your Slate Art app has grown far beyond the copy that lives in MathGPL: a new writing surface, premium effects, text presets, room work, sun light, background music, uploaded assets and many more settings. The copy inside MathGPL is roughly a quarter of that code.

Plan: delete the old copied Game engine from MathGPL and rebuild it from the current Slate Art, then reconnect it to the MathGPL parts that Slate Art does not have (Questions, Floating Numbers lines, classes, assignments, results).

## What changes

- The Game visuals, surfaces, writing, rooms, lighting, effects, rewards, music and settings become exactly what Slate Art has today.
- Existing saved games in MathGPL are deleted, as agreed — everything is created fresh on the new engine.
- Uploaded backgrounds, sun images and music tracks are saved to your account (cloud storage) instead of only this browser, so students and other devices can see them.
- Everything MathGPL adds stays untouched: Questions belong to the Game, Floating Numbers owns the mathematics and question time, Line 0 stays the read-only question, Game Lines 1,2,3… map to Floating Numbers lines, Class assign/launch, student Play, timers, coins, lives, rewards and results.

## What does not change

- No redesign or reinterpretation of Slate Art — it is carried over as it works.
- No second maths engine, no Smartboard on top of the Game; Game Play keeps the Slate world plus the docked number panel.
- Navigation stays Classes → Game → Adventure.

## Technical outline

1. Bring across the upgraded engine from the Slate Art snapshot into MathGPL's namespaced paths:
   - `src/lib/slate/`: `types`, `defaults`, `surfaces`, `rooms`, `environments`, `layout`, `pbr`, `rewards`, `text3d`, `textPresets`, `audio`, `music`, `assets`, plus the new `vfx/` folder (clock, geometryCache, perf, premiumProfiles, prepare, profiles, registry, script, stages).
   - `src/components/gameslate/world/`: `WorldStage`, `SlateColumn`, `RoomShell`, `Effects`, `EffectsPremium`, `PremiumBombBody`, `RewardBody`, `BackgroundLayer`, `ScriptStage`, `SunLight`, `WorldBoundary`, `materials`, `textures`, `vfxTextures`, `pbr`, and `sections/` (`NewWritingSurface`, `SlateSection`, `construction`, `premiumSurfaceGeometry`).
   - `src/components/slate/`: `ControlPanel`, `WritingLayer`, `RewardLayer`, `RewardStatusBar`, `TextColourPicker`, `TextPresetPicker`, `materialText`, `text3d/` (DimensionalText, ExtrudedExpression, InscribedText, TileText, WritingRegion, glyphLayout).
2. Assets: copy the real image files (backgrounds, surfaces, rewards) and re-create the 49 CDN pointers (PBR texture sets, HDR environments, Kenney VFX sprites) in this project by downloading each from the source project's preview origin and re-uploading with `lovable-assets create`. Any download that fails is reported rather than silently substituted.
3. Dependencies: add `opentype.js` (used by the new glyph layout); `three`, `@react-three/fiber`, `@react-three/drei`, `troika-three-text` are already present.
4. Keep MathGPL-only modules and adapt them to the new types: `gameBoard.ts`, `gameQuestions.ts`, `gameAssignments.ts`, `pattern.ts`, `QuestionsPanel.tsx`, `useGameRuntime.ts`, `GamePlayPage.tsx`, `GameSlateEditorPage.tsx`, `GameSlateGalleryPage.tsx`, routes under `src/routes/game/`.
5. Storage: keep the cloud `slate_games` / `slate_game_questions` tables (no browser localStorage engine). `storage.ts` keeps the Supabase read/write shape and gains the new normalisation (surface colour, background asset id, assets/effects defaults, `math-coin` → `math-vault`). The Slate Art `assets.ts` IndexedDB layer is replaced by an upload helper writing to the existing `game-assets` bucket, with the game storing the object path.
6. Migration: delete existing rows in `slate_games`, `slate_game_questions`, `slate_game_progress` and the hidden `kind="game"` assessments they created, so nothing references the retired engine.
7. Bring across the Slate Art dev pages (`dev.surfaces`, `dev.effects`) as internal-only routes for surface/effect checking, or skip them if you prefer a smaller surface area.
8. Verify: typecheck, the slate/game test suites, `/game`, the editor (surfaces, writing, effects, rewards, music), and `/game/play/...` with the docked Floating Numbers panel.

## Not included

- No changes to Floating Numbers, Smartboard, Lesson Notes, Classes or reports beyond reconnecting the rebuilt Game.
- Teacher-configurable coin economy / shop remains a later step.
