# MathGPL Community — the same workspace, read-only, community data

Replace the standalone Community dashboard with a **mirror of the normal workspace**: clicking MathGPL Community drops you onto the same rotating building, with the same buildings and sections. Only two things change: the content comes from what other people shared, and nothing can be created or edited.

## 1. Rename

Everywhere in the UI: **MyGPL Community → MathGPL Community** (homepage button, nav entries, page titles, dialogs, head metadata).

## 2. Community is a mode, not a dashboard

Community lives under the `/community/...` path prefix and renders the *same* pages as the private workspace, wrapped in a "community mode" context.

```text
/                        rotating building — my own content, fully editable
/community               rotating building — identical scene, community mode on
/community/lesson-notes  same Lesson Notes page, shared notes only, read-only
/community/adventure     same Adventure page, shared adventures only
/community/backgrounds   shared backgrounds
/community/buildings     shared buildings
/community/assets        shared assets
/community/classes       shared live classes -> Request Access
```

The current `/community` browse grid, its shell and its `$kind` section pages are removed. The rotating building becomes the community entry point, and every building click stays inside the `/community` prefix.

While in community mode:
- All authoring controls are hidden: Create Notebook, AI Generate, Edit, Rename, Duplicate, Delete, upload buttons, settings gears, homepage-customisation buttons.
- Only the **Administrator (platform owner)** keeps layout/view controls, so you can still shape how the community workspace looks.
- Each card gains one primary action: **Copy to My Workspace** (plus Preview and Like).
- A persistent **Go to My Workspace** button returns to the private version of whatever section you are in.

## 3. Section behaviour

**Lesson Notes** — grid of shared notes showing cover, title, creator username, subject, class, hashtags, likes, active downloads. Opening one shows a read-only preview. `Copy to My Workspace` deep-copies it into my private shelf where it is fully mine (edit, rename, extend, delete) and the original is untouched.

**Backgrounds / Buildings / Assets galleries** — shared items only; Preview, Like, Copy to My Workspace. A copied item lands in my own gallery for that kind.

**Adventure** — shared adventures/games only; Preview, Like, Copy to My Workspace (copies the game and its scenes into my Adventure workspace).

**Classes** — no copying. Shared live classes show teacher, level and member count with a **Request Access** button. The owning teacher sees pending requests and can Accept or Reject; on accept the requester becomes a class member. (Reuses the existing join-request flow.)

## 4. Going live from the private workspace

Everything is private by default. Sharing happens only in the private workspace via **Share with Community** on the item itself (already in place for lesson notes and classes; extended to backgrounds, buildings, assets and adventures). Unsharing removes it from the community immediately; copies already made stay with their new owners.

Also: teacher-created diagrams and smart structures gain an **Add to Asset Library** action, and library assets can then be shared with the community like any other asset.

## Technical notes

- New `CommunityModeProvider` (`src/lib/community/mode.tsx`) exposing `{ isCommunity, linkTo(path) }`; a `useCommunityMode()` hook lets shared pages hide authoring UI and rewrite links so navigation never leaks out of the prefix.
- New `src/routes/community/*` files reusing the existing page components (`Index`, `LessonNotesPage`, `Adventure`, `Backgrounds`, `Assets`, class list) rather than duplicating them; `RotatingAdventureScene` gets a route-prefix prop so ring slots route to `/community/...`.
- Community reads keep using `community_resource_cards` / `community_resources`; each section filters by `kind`. Copy actions reuse `duplicateNotebook` for notes and add equivalent copy helpers for gallery kinds and adventures, all recording a `community_downloads` row so active-download counts stay accurate.
- Gallery kinds need per-member storage to receive copies (backgrounds, buildings, assets). If no per-member gallery table exists yet, add one additive migration (`member_gallery_items`: kind, title, media url, source resource id, owner) with GRANTs and owner-scoped RLS, plus an owner read policy.
- Existing files removed/retired: `CommunityShell.tsx`, `CommunityBrowsePage.tsx`, `src/routes/community/index.tsx` grid, `src/routes/community/$kind/index.tsx`. `PublishDialog` and `UsernameDialog` stay (they belong to the private workspace).
- Admin-only layout controls gated by the existing platform-owner role check.
