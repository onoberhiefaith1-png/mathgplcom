# 3D Academy World — Phase 1

The existing rotating building stays exactly as it is. It becomes the entrance shell: clicking any of its designated sections opens **one shared** Academy World — a 3D corridor lined with rooms that display the school's courses, games, adventures and assessments as products.

Nothing in the hierarchy is hard-coded. Every room, category, topic, subtopic and product placement is a database row a teacher creates, renames, reorders, hides or deletes. "JSS1", "Algebra" etc. exist only as clearly-marked sample content.

## What Phase 1 delivers

**Entry**
- Every clickable ring/core section of the current building navigates to `/academy` (same world, same data — no per-section copies).
- A back door to the homepage is always visible inside the world.

**The world (student view)**
- A glide-down-the-corridor hallway: camera moves left/right along an infinite exhibition corridor of room portals. Rooms are positioned from their stored `position`, so 5 rooms or 50 rooms both work; only nearby rooms are mounted.
- Touch/mouse/keyboard navigation with large smartboard-sized Previous Room / Next Room / Hall controls.
- Entering a room drops the immersive corridor into a showroom view: Categories → Topics → Subtopics → Products, each level a premium card wall over the 3D backdrop.
- Product cards show artwork, title, short description, type badge (Course / Game / Adventure / Assessment), difficulty, and a Start button that opens the existing course/game/adventure experience unchanged.
- Breadcrumb (Academy / Room / Category / Topic / Subtopic) with every crumb clickable, plus a back button at each level.
- Featured shelf in the Main Hall showing flagged products.
- Every level has a real empty state ("No topics yet — add your first") instead of a blank 3D space.

**Teacher / school editing (real operations, not mockups)**
- An "Edit Academy" mode with a management panel: Rooms, Categories, Topics, Subtopics, Products.
- Add, rename, edit description, change image/icon, hide/show, duplicate, delete, and drag-to-reorder at every level — each action writes to the database immediately and the 3D world re-renders from that data.
- Product placement: pick any existing course/game/adventure/assessment and place it under a subtopic. Placements are references — the canonical course row is never duplicated, and the same product can be placed in several locations.
- Move a product (or a whole subtopic/topic) to a different parent, via a Move dialog and via drag-and-drop.
- Feature/unfeature a product for the Main Hall shelf.
- Live preview: the editor is split-screen — panel on the left, the actual 3D world on the right, updating as you edit.

**Permissions**
- Platform owner / co-admin: everything, across workspaces.
- School and teacher: full editing of their own workspace's academy.
- Student and parent: read-only navigation; no edit affordances rendered and no write access at the database level.

**Persistence**
- All structure lives in the database, scoped to the workspace (`org_id` / owner), so a room created today is still there tomorrow and students see the same structure their teacher built.

## Explicitly Phase 2 (not in this pass)

Multiple selectable hallway templates and the administrator template manager, uploadable 3D assets, per-room lighting/floor/ceiling/atmosphere controls. Phase 1 ships one hallway design behind a `template` column so adding designs later needs no data change.

## Technical notes

- **Data model** — five new tables, all with `position`, `is_visible`, image/icon refs, timestamps, workspace scoping: `academy_rooms`, `academy_categories` (→ room), `academy_topics` (→ category), `academy_subtopics` (→ topic), and `academy_placements` (→ subtopic, plus `product_kind` + `product_id` referencing existing `courses` / `games` / `adventure_games` / `assessments`, `is_featured`). One `academies` row per workspace holds the selected `template` and hall copy. Relational, no JSON blob; each row independently editable. GRANTs plus RLS: workspace members read visible rows, owners/teachers/admins write.
- **3D layer** — reuses the existing React Three Fiber setup and asset/signed-media components from `RotatingAdventureScene`. New `AcademyWorld` scene: corridor segments generated from room rows, windowed mounting so room count doesn't hurt frame rate. The renderer reads structure only — data layer and presentation layer stay separate so a future template swap can't damage the hierarchy.
- **Routes** — `/academy` (world + drill-down state in search params so links are shareable), `/academy/edit` (split-screen editor, gated to editing roles).
- **Server** — `createServerFn` modules for read (workspace tree) and write (CRUD, reorder, move, feature, visibility), authenticated via the existing Supabase middleware. Drag-and-drop uses the project's existing dnd library and persists new ordering.
- **Building wiring** — ring/core click handlers in the existing scene are repointed at `/academy`; the building's own geometry, artwork, slots and settings are untouched.
- **Verification** — end-to-end pass: create room → category → topic → subtopic → place product → reorder → move → refresh (persists) → view as student (read-only, sees the new structure) → open a product and confirm the existing learning experience still works.
