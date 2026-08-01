# Rotating Building as navigation hub (Community)

The rotating building stops being a content surface and becomes the gateway. Community content moves
into dedicated workspaces reached through Teaching Hub, Building Settings, or MathGPL Live.

## 1. Community homepage (`/community`)

Keeps only: the rotating building, a **Teaching Hub** button, a **MathGPL Live** button, the
**MathGPL Community** badge with the user's `@username`, the account/profile entry, and a
**Settings** (Building Workspace) button.

The six section buttons currently pinned along the bottom (Lesson Notes, Classes, Adventure,
Backgrounds, Buildings, Assets) are removed from the homepage. Ring segments route to
`/community/teaching-hub` instead of straight to Lesson Notes.

## 2. Navigation pipelines

```text
/community                       rotating building (hub only)
  -> /community/teaching-hub     Lesson Notes | Classes | Adventure
       -> /community/lesson-notes   shared notes + Lesson Notes Assets
       -> /community/classes        shared classes -> Request Access
       -> /community/adventure      shared adventures -> Copy to My Workspace
  -> /community/building         Building Workspace
       -> backgrounds | buildings | building assets | decorations | effects
  -> /community/live             community live sessions -> Join Session
```

## 3. Community Teaching Hub

A new page mirroring the private Teaching Hub card layout, with exactly three tiles: Lesson Notes,
Classes, Adventure. No SmartBoard tile, no authoring controls.

## 4. Lesson Notes page

Same shared-note grid as today (cover, title, creator username, subject, class, hashtags, likes,
active downloads, Copy to My Workspace), plus a second section on the same page:

**Lesson Notes Assets** — diagrams, graphs, mathematical illustrations, tables and visual teaching
resources published on their own, separate from full notes. Each card offers Preview, Like and
**Copy to My Asset Library**, which lands the item in the user's own Lesson Notes asset library.

A tab/segment switch at the top of the page toggles between **Notes** and **Assets**.

## 5. Classes

Cards show class name, teacher, school, student count, subject and creator username. Single action:
**Request Access**; the owning teacher accepts or rejects through the existing join-request panel.

## 6. Adventure

Cards show preview art, creator, topic, likes and downloads, with **Copy to My Workspace**.

## 7. Building Workspace (`/community/building`)

The Settings button on the rotating building opens one workspace holding every building-related
resource, as tabs or tiles: **Background Gallery**, **Building Gallery**, **Building Assets**,
**Decorations**, **Floating objects**, **Rewards**, **Special effects**. Community versions can be
previewed, liked and copied into the user's own workspace. In the private workspace the same
Settings button keeps opening the existing three customization flows (Change Background, Edit
MathGPL Building, Replace Building) — unchanged.

## 8. MathGPL Live (`/community/live`)

Shared live sessions and classrooms: live teachers, live classrooms, scheduled sessions, with a
**Join Session** action reusing the existing join flow.

## Technical notes

- `src/pages/community/CommunityHome.tsx`: strip the bottom section strip; keep badge/username and
  add Teaching Hub, MathGPL Live and Settings buttons. `RotatingAdventureScene`'s `routeFor` points
  at `/community/teaching-hub`.
- New routes under `src/routes/community/`: `teaching-hub/index.tsx`, `building/index.tsx`,
  `live/index.tsx`. Existing `backgrounds`, `buildings`, `assets` section routes stay reachable but
  are now entered from the Building Workspace rather than the homepage; `COMMUNITY_SECTIONS` in
  `src/lib/community/mode.tsx` is regrouped into `TEACHING_SECTIONS` and `BUILDING_SECTIONS` so the
  in-page nav only lists siblings of the current pipeline.
- New `CommunityTeachingHub` page reusing `WorkspaceCard` for the three tiles.
- `CommunitySectionPage` gains an optional `tabs` prop so `/community/lesson-notes` can render the
  Notes and Lesson Notes Assets feeds from one page. Lesson-note assets are a distinct community
  kind (`lesson_asset`); if that value isn't in the `community_resources` kind constraint yet, add
  one additive migration extending the allowed kinds (plus `decoration`, `effect`, `reward` for the
  Building Workspace) — no table changes, no data loss.
- Copy actions reuse the existing copy engine; the lesson-asset copy target is the user's asset
  library store used by the Asset Library panel.
- `/community/live` reads shared sessions from the existing `sessions` data with the community flag,
  and Join Session reuses `JoinSessionPanel`.
- Every new route gets its own `head()` with a unique title/description and og/twitter metadata.
