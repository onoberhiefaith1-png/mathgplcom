## Source

Everything is copied verbatim from **Remix of gamedraft (53)** (`d5636c20-…`) — the project in your screenshots. Nothing is redesigned or rebuilt. This project already shares the same `src/components/gamebuilder/*` canvas stack (GameCanvas, SettingsPanel, EffectsRail, AssetLibraryModal, ProgressColumn…), so the copied gallery code drops straight in.

What is missing here today: `RewardConfigPanel.tsx`, `GroupsPanel.tsx`, the whole class-gallery library, the two gallery pages, the gallery half of the game editor, and the four database tables behind them.

## Part 1 — Group Bars ("+ New Group") on the Assessment Dashboard

Copy verbatim:
- `src/lib/adventures/groups.ts`
- `src/hooks/useAdventureGroups.ts`
- `src/components/adventures/GroupsPanel.tsx`

Mount `GroupsPanel` in `src/pages/class/AdventureDashboardPage.tsx` exactly where it sits in the source (below the status buckets), passing class members, the canvas bars, group context, per-bar stats and reserved bar ids.

Additive migration (new tables only):
- `adventure_groups` (id, class_id, game_id, name, progress_element_id)
- `adventure_group_members` (id, class_id, game_id, group_id, student_id)
- GRANTs + RLS: teacher (class owner) full access, class members read.

Behaviour preserved: each group owns one Progress Bar, only unassigned students sit in "Whole Class", bars already used by the Time Bar or a linked lesson can't be picked twice.

## Part 2 — Class Gallery (copied whole)

Copy verbatim:
- `src/lib/games/classGallery.ts`, `src/lib/games/classGalleryRewards.ts`, `src/lib/games/galleryScroll.ts`
- `src/components/gamebuilder/RewardConfigPanel.tsx`
- `src/pages/ClassGalleryEditorPage.tsx`
- `src/pages/student/StudentGalleryPage.tsx`
- The gallery-specific branches of `src/pages/GameEditorPage.tsx` (fullscreen one-section-at-a-time stage, Extend Canvas / Shrink, scroll memory, Play Preview, Live, Focus, zoom Fit/100%/200%, camera target, toolbar) merged into this project's `src/pages/adventure/AdventureGameEditor.tsx` — copied, not reinterpreted.

Additive migration:
- `class_galleries` (one canvas per class)
- `class_gallery_rewards` (class_id, game_id, reward_element_id, asset/media fields, start & end position, transform)
- GRANTs + RLS matching the source: teacher owns/edits, class students read.

Routes (same paths as source):
- `/teaching-hub/classes/:classId/gallery` → `ClassGalleryEditorPage`
- `/student/class/:classId/gallery` → `StudentGalleryPage`

Each class gets its own independent gallery, created on first open.

## Part 3 — Link to Achievement Dashboard

`RewardConfigPanel` keeps its **"Link to Class Gallery"** action untouched. When linked:
- the reward is stored in `class_gallery_rewards` for that class + game, not inside the gallery canvas JSON;
- Start Position / End Position / Size / Rotation / Opacity / animation preview all keep working exactly as they do now in the source;
- when a student's progress bar fills, the reward animates out of the dashboard and lands in that class's Gallery — the existing source logic, copied as-is.

## Part 4 — Entry points

- Teacher: the **Gallery** tile already on the class dashboard grid routes to the class gallery editor.
- Student: **Gallery** tile on the student class page routes to the read-only gallery.

## Technical notes

- Only additive migrations; no existing table or column is altered.
- Copies preserve file names and import paths so future diffs against the source project stay clean.
- Any source file importing something this project lacks is copied along with its dependency rather than rewritten.
