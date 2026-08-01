# Community previews + a personal Asset Library that can be shared

Two connected pieces of work.

## 1. Shared lesson notes and adventures keep their real cover, and can be viewed

Today a community card shows a plain gold strip and only offers "Copy to My Workspace".

- **Real cover art.** Publishing a lesson note stores its designed cover (theme, editable
  cover text, AI artwork path, colour index, subject/topic/class/session) in the listing
  payload, so the community card renders the *same* cover the teacher sees on their shelf.
  Publishing an adventure stores its cover image; the card shows it. Nothing is regenerated.
- **View before copying.** Every lesson-note and adventure card gets a **View** action next to
  Copy to My Workspace, opening a read-only page:
  - `/community/lesson-notes/:id` — the note rendered exactly as written (cover, sections,
    maths, tables, diagrams, graphs, 3D), with no toolbar, no AI, no editing, no dragging.
  - `/community/adventure/:id` — the adventure's cover, title, creator and scene/question
    summary, playable-preview only.
  Both pages carry a single **Copy to My Workspace** button, so viewing and copying are one flow.
- Existing cards already listed keep working; older listings without a stored cover fall back
  to the current gold strip.

## 2. Diagrams → your Asset Library → MathGPL Community

### Add to Asset Library

Any diagram a teacher makes in a lesson note — 2D geometry, 3D workspace, or AI-generated —
gets an **Add to Asset Library** action in the right-hand Properties Panel (the universal
asset-editing surface, no floating popovers). It opens a small form:

- **Standard Name** (required)
- **Short Code** (uppercase, used by the `@` menu — auto-suggested from the name)
- **Section** — one of the five Asset Library sections:
  1. Mathematical Symbols
  2. Elastic Band Structures
  3. Parametric Vector Diagrams
  4. Table Grids & Data Charts
  5. Interactive Manipulatives

Saved assets are private to that teacher. They appear in the Asset Library dialog and the `@`
menu inside their chosen section, under a **My assets** group, and insert the exact diagram
back into any note.

### Share to MathGPL Community

Each *teacher-created* asset tile (never the built-in ones) carries the same "⋯" menu used
everywhere else, with **Share with MathGPL Community**. The publish sheet pre-fills the
asset's name and its section, and the section travels with the listing.

In the community mirror, **Teaching Hub → Lesson Notes → Lesson Notes Assets** gains section
filter pills for those same five sections. Copying an asset drops it into the member's own
Asset Library, in the same section, with its name and short code — independent from then on.

## Technical notes

- **Migration (additive only).**
  - `public.custom_assets` — `id, owner_id, name, short_code, section, source ('2d'|'3d'|'ai'),
    payload jsonb, preview_path, created_at`, unique `(owner_id, short_code)`. GRANT
    select/insert/update/delete to `authenticated`, ALL to `service_role`, RLS scoped to
    `owner_id = auth.uid()`.
  - Read policies so a published listing is viewable: `SELECT` on `notebooks`,
    `notebook_sections`, `notebook_subsections`, `notebook_blocks` and `games` when a
    `community_resources` row with matching `source_id` and `status='published'` exists
    (via a `security definer` helper `public.is_community_published(kind, source_id)`).
    Existing owner policies are untouched.
- **Publishing payload.** `publishResource` calls in `LessonNotesPage.tsx` / `GameCard.tsx`
  gain `cover_config`, `color_index`, `subject`, `topic`, `class_name`, `session`, `cover_url`.
  `CommunityResourceCard.tsx` renders `NotebookCover` for `lesson_note` and an `<img>` for
  `adventure`.
- **Read-only note view.** New `src/pages/community/CommunityNotebookViewPage.tsx` reuses
  `PageFrame` plus the existing block/asset renderers behind a `readOnly` flag; the editor
  (`DocumentEditor`) is not mounted, so no authoring code can run.
- **Custom asset registry.** New `src/lib/lessonnotes/assets/customAssets.ts` (Supabase-backed
  store + `useSyncExternalStore` subscription) merged into `ALL_ASSETS`/`searchAssets` as
  `render: { kind: "visual" }` entries carrying the stored node JSON; `insertAsset` restores
  the node verbatim. `AssetLibraryDialog.tsx` renders a "My assets" band per section with
  `ShareMenu` (`kind="lesson_asset"`, payload `{ section, node, preview_path }`).
- **Community section filter.** `CommunitySectionPage.tsx` gains optional payload-based filter
  pills, used by the Lesson Notes Assets tab; `downloadResource` handles `lesson_asset` by
  inserting into `custom_assets` instead of `member_gallery_items`.
- Community mode stays read-only: the "Add to Asset Library" and share controls are hidden
  whenever `useCommunityMode().isCommunity` is true.
