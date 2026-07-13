
## Goal

Bring the upgraded, simplified game builder from **Remix of gamedraft** into this project, and mount it on this project's existing Adventure games layout (the header/dashboard shell you like here). Every setting that already works in gamedraft must survive the port — nothing gets left behind.

## What's over there vs what's here

**Remix of gamedraft (source, upgraded features)**
- Pages: `GamesListPage.tsx`, `GameEditorPage.tsx`
- Components: `src/components/gamebuilder/` — `GameCanvas`, `GameCard`, `AssetLibraryModal`, `AssetsPanel`, `EffectsRail`, `SceneStrip`, `SettingsPanel`, `ProgressColumn`, `CanvasElementView`, `ChromaVideo`, `SignedMedia`
- Lib: `src/lib/games/` — `types.ts`, `games.ts`, `gameQuestions.ts`, `assets.ts`, `urls.ts`, `progressPresets.ts`, `removeBackground.ts`, `classGames.ts`
- Backend: `games` + `game_assets` tables, `game-assets` storage bucket, `generate-game-cover` edge function, game-questions notebook wiring
- Feature set to preserve verbatim:
  - Scenes (multi-scene canvas with per-scene background + elements)
  - Element kinds: `background`, `reward`, `progress_bar`, `effect`
  - Progress bar (built-in 10-slot tower): presets, `totalMarks`, `currentMarks`, `segments`, `fillStyle` (`plain` / `effect`), per-slot energy overrides (`slotEffects`), default energy, glow, effectScale, plainColor, question-notebook wiring
  - Compositing: `blend`, `bgRemoval` (`none` / `screen-black` / `chroma`), auto chroma-key detection, `keyColor` + `keyTolerance`
  - Directional tint (`color`, `strength`, `direction`, `softness`)
  - Three-axis slant (`lean` / `slide` / `tilt`) with legacy migration
  - Animation (`type`, `amplitude`, `speed`, `loop`, `delay`, `fadeIn`, `fadeOut`, `trigger`)
  - Camera target per scene
  - Asset library (upload + URL pick), energy-mode picking, per-game asset import
  - AI game-cover generation
  - Meta dialog (title + topic + subtopic) required so AI question generation has context

**This project (target layout to keep)**
- Pages: `src/pages/adventure/AdventureGamesDashboard.tsx`, `src/pages/adventure/AdventureGameEditor.tsx`
- Routes already exist under `/adventure/games` and `/adventure/games/:gameId`
- The current editor is the older complex scene system (obstacle/door/vault, `SceneFrame`, `ChallengeTypePicker`, layout items, motion/playback/trigger). This is the "complex game structure" you asked to retire.

## Approach

Replace the complex Adventure editor with the simplified gamedraft builder, but re-skin its outer chrome (header, dashboard grid, breadcrumbs, page background) to match this project's current Adventure look — so the pages *feel* like the rest of MATHGPL while the inner canvas/settings are the upgraded gamedraft ones.

### 1. Backend port
- Copy every gamedraft migration under `supabase/migrations/` that touches `games`, `game_assets`, `game-assets` bucket, RLS, GRANTs. Rewrite as one fresh migration in this project so `games` / `game_assets` exist here with identical columns, RLS, GRANTs, and bucket policies.
- Port the `generate-game-cover` edge function into `supabase/functions/generate-game-cover/`.
- Preserve the "game questions notebook" wiring (`gameQuestions.ts`) so the progress bar's hidden lesson-note still gets created.

### 2. Code port (verbatim, then re-skin)
- Copy `src/lib/games/**` from gamedraft → this project unchanged.
- Copy `src/components/gamebuilder/**` from gamedraft → this project unchanged.
- Copy `GameEditorPage.tsx` from gamedraft → this project as `src/pages/adventure/AdventureGameEditor.tsx` (overwriting the current complex editor). Keep the internal canvas / rails / settings panel exactly as gamedraft has them.
- Copy `GamesListPage.tsx` from gamedraft → merge into `src/pages/adventure/AdventureGamesDashboard.tsx`, keeping this project's page header/back-nav styling but swapping the card grid to `GameCard` from gamebuilder.

### 3. Layout blend
- Reuse this project's existing header pattern (sticky top bar with `ArrowLeft → Games` back-nav, project typography, muted-foreground breadcrumb of topic · subtopic).
- Keep this project's dashboard framing (page padding, empty-state card style, Add button placement) around the new `GameCard` grid.
- Everything inside the editor stage (canvas, EffectsRail, SettingsPanel, SceneStrip, AssetLibraryModal, meta dialog) ships as-is from gamedraft — no visual changes to the builder controls, since those are the "settings that must all be there".

### 4. Route wiring
- Keep the existing route paths `/adventure/games` and `/adventure/games/:gameId` in `App.tsx`. Point them at the ported pages.
- Delete the now-unused complex-editor pieces (`SceneFrame`, `ChallengeTypePicker`, `src/lib/adventure/**` scene APIs) only after confirming nothing else in this project imports them; otherwise leave them dormant.

### 5. Verification
- Build passes; `/adventure/games` lists games, create → opens the new editor.
- Add background, add reward, drop a progress tower, apply an effect as energy, tweak `blend` / `bgRemoval` / `chroma` / `tint` / `slant` / `animation` — every panel from gamedraft renders and persists.
- Progress bar: set `totalMarks=100`, `segments=10` → each 10-mark step lights a slot (same as gamedraft).
- Autosave writes to `games.canvas`; reload restores scenes.

## Technical notes

- `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` are auto-generated in this project — the migration will regenerate `types.ts` so `games` / `game_assets` become typed automatically.
- The gamedraft `AssetKind` enum (`background | reward | progress_bar | effect`) fully replaces this project's `SceneKind` (`obstacle | door | vault`). No data migration is needed because this project's `adventure_*` tables and the gamedraft `games` table are independent — old adventure data stays untouched.
- No user-facing routes change, so bookmarks in `/adventure/games/...` keep working.
- No frontend business logic beyond what already exists in gamedraft is added; this is a straight port + shell blend.

## Out of scope

- No changes to the rotating academy scene, Algebra subject pages, or any of the existing math games.
- No changes to lesson notes / smartboard / floating numbers.
