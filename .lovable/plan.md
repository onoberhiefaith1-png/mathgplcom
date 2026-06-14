# Adventure Game Mode — v1 (Editor only)

Scope of this plan: GAME MODE entry, dashboard, create-game flow, scene editor with backgrounds + effects + questions, and Obstacle / Door / Vault challenge configuration. **No student join/play yet** — that's a follow-up.

## 1. Entry point on Adventure page

- Keep `AdventurePortalScene` untouched.
- Add a `GAME MODE` button top-right in `src/pages/Adventure.tsx` → links to `/adventure/games`.

## 2. Adventure Game Dashboard (`/adventure/games`)

Visual structure mirrors `LessonNotesPage`: header + grid of cards.

- Top toolbar: `Create Game` button + search.
- Card content: Game Name, Topic, Subtopic, Scene count, Last modified.
- Card click → opens editor at `/adventure/games/:gameId`.
- Empty state with prompt to create the first game.

**Create Game dialog** asks: Game Name, Topic, Subtopic, Description → inserts row → routes to editor.

## 3. Game Editor (`/adventure/games/:gameId`)

Hybrid layout per your guidance:

- **Outer flow = vertical stack.** Scenes render top-to-bottom with a downward arrow connector between them. Drag a scene's handle to reorder. `Add Scene` button at the bottom.
- **Inside a scene = free placement.** Each scene is a fixed-aspect frame (e.g. 16:9) showing the chosen background. Effects, Question Progress Containers, and labels are absolute-positioned children with drag + resize handles. No snapping, no collision — just `pointer` drag updating `x,y,w,h` percentages relative to the scene frame.
- Whole-scene controls: rename, duplicate, delete, scale slider (scales the scene frame on the page; inner element % positions stay valid).

## 4. Add Scene flow

Step 1 — **Choose Background** → opens an Adventure Background Library modal:
- Pre-seeded with existing adventure island assets (`mathgpl-palace`, `central-dome-core`, `algebra-island`, `geometry-island`, `calculus-island`, `statistics-island`, `trigonometry-island`, `adventure-clouds`) plus placeholders for Castle Entrance, Library, Observatory, Crystal Hall, Staircase, Bridge, Courtyard, Throne Room (upload-when-ready).
- Upload Custom Background uploads to a new `adventure-assets` storage bucket.

Step 2 — **Choose Challenge Type**: Obstacle / Door / Vault. Sets `scene.kind`.

## 5. Challenge modes

### Obstacle (collaboration)
- Pick an effect from the existing Video Effects library (`src/assets/effects/video-fx/`) + custom upload.
- `Add Questions` opens the **embedded question generator** (see §6).
- Config: `requiredProgress` (e.g. 500). Each correct solve from any student adds `question.marks`. Displays `current / required` progress bar in the scene preview.

### Door (coordination)
- Effect picker + questions.
- Each question auto-spawns one `QuestionProgressContainer` in the scene (placed in a default row, draggable afterwards).
- Logic flag: `claimOncePerQuestion = true` (first solver claims the marks).

### Vault (competition)
- Add **multiple vaults** (Diamond/Gold/Silver/Bronze presets + custom). Each vault has: effect, questions, reward (coins).
- Logic flag: `firstCorrectWins = true` per vault.

## 6. Question authoring — reuse Lesson Note generator

- Wrap the existing question generator in a new `QuestionGeneratorModal` that mounts it with feature flags: hide Introduction, Conclusion, and Sections; show only Game Questions, AI Generate, Floating Numbers, Solution Builder, Marks.
- On save, the resulting question payloads are written to `scene_questions` (with the same shape the generator already produces) and listed inside the scene card.
- No changes to the underlying AI / pedagogy pipeline.

## 7. Data model (Lovable Cloud)

New tables (RLS: owner-only for v1; student-play policies added later):

- `adventure_games` — name, topic, subtopic, description, owner_id.
- `adventure_scenes` — game_id, order_index, kind (`obstacle|door|vault`), background_ref (library id or storage path), required_progress, layout_json (free-position children: effects, containers, vaults with `{x,y,w,h}` percentages).
- `adventure_scene_questions` — scene_id, vault_id (nullable), question_payload jsonb, marks, claim_once bool.
- (Optional) `adventure_backgrounds` — curated library entries; custom uploads also recorded here.

Storage bucket: `adventure-assets` (private, owner-only) for custom backgrounds/effects.

## 8. Files to add / change

- `src/pages/Adventure.tsx` — add GAME MODE button.
- `src/pages/adventure/AdventureGamesDashboard.tsx` (new).
- `src/pages/adventure/AdventureGameEditor.tsx` (new).
- `src/components/adventure/editor/` (new): `SceneStack.tsx`, `SceneFrame.tsx`, `DraggableResizable.tsx`, `BackgroundLibraryModal.tsx`, `ChallengeTypePicker.tsx`, `ObstacleConfig.tsx`, `DoorConfig.tsx`, `VaultConfig.tsx`, `QuestionGeneratorModal.tsx`.
- `src/lib/adventure/` (new): types + CRUD helpers against the new tables.
- `src/App.tsx` — two new routes.
- One Supabase migration for the tables, GRANTs, RLS, owner policies, `updated_at` triggers, plus the storage bucket.

## 9. Explicitly out of scope for v1

- Student `Join Adventure` / play runtime.
- Real-time progress aggregation.
- Reward/coin economy.
- Collision detection, snapping, multi-select, undo/redo inside scenes.

These slot in cleanly on top of the data model above in a follow-up pass.