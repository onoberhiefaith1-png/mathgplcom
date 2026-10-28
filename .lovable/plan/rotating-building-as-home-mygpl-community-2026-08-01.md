# Rotating Building as Home + MyGPL Community

Two changes: every account lands on the Rotating Building homepage after login, and a new
Community workspace is added beside the existing navigation for all five roles.

## Part 1 — Rotating Building becomes the landing page

- After sign-in (and after the role dispatcher runs), every role — Administrator, School,
  Teacher, Parent, Student — arrives at `/` (the Rotating Building) instead of its dashboard.
- From the homepage the user enters their workspace through the existing Account menu and the
  corner entry buttons (Teaching Hub / Join Class for students, plus the new Community button).
- The role-specific dashboards stay exactly as they are; only the automatic redirect target changes.
- Impersonation ("Enter Workspace") keeps landing on the homepage too, with the banner intact.

## Part 2 — MyGPL Community

### Identity
- No second account. On first entry the user picks a unique **username**; that becomes their
  creator identity (username, avatar-less profile, likes, active downloads, hashtags).
- A profile page lists everything that creator has published.

### Workspace shell
Community reuses the familiar workspace look (same shell, cards and typography as Teaching Hub /
MathGPL Live) so it feels like the user's own workspace, but every card is community content.

Sections: Lesson Notes, Classes, Adventures, Backgrounds, Buildings, Assets.

### Roles
- **Administrator** — full rights inside Community: create, edit, delete, publish, unpublish,
  moderate and manage any resource.
- **School / Teacher / Parent** — browse, search, discover, publish their own work, and **Download**
  (which copies into their own workspace). They never edit community records directly.
- **Student** — simplified view: discover public classes, request access, and browse permitted
  teacher resources. No publishing.

### Publishing and downloading
- Each publishable resource type gains a "Share with MyGPL Community" action in its own workspace
  (lesson note menu, class settings, background/building/asset gallery, adventure).
- Publishing captures a snapshot plus title, description, hashtags and creator username.
- **Download never touches the device.** It copies the resource straight into the matching place in
  the user's workspace: Lesson Notes → Lesson Notes, Background → Background Gallery, Building →
  Building Gallery, Asset → Asset Gallery, Adventure → Adventure.
- Copies are fully independent. Editing a copy never changes the original; unpublishing or deleting
  the original removes it from Community and blocks new downloads but leaves every existing copy.

### Active downloads
Each download records a link row between the published resource and the copy it created. The card
shows **active downloads** = number of copies that still exist. Deleting a copy decrements it.

### Classes
- A class is Private or Shared with Community.
- Shared class cards show class name, teacher username, subject, student count and description.
- The join button is **Request Access** (no code). The teacher sees the request in the existing
  class requests panel and approves or rejects; approval adds the student to the class immediately
  and they then behave like any other member.

### Hashtags and search
Free-form hashtags (e.g. `#Algebra`, `#JSS2`, `#GCSE`). Search ranks hashtag matches first, then
title, then description. Filters by resource type and role.

### Built for later
Schema and UI leave room for comments, ratings, followers, featured creators, trending, collections
and verified educators without restructuring.

## Suggested build order

1. Landing-page change + Community foundation (username, workspace shell, publish/download engine,
   likes, hashtags, active-download counting) with **Lesson Notes** and **Classes** live end to end.
2. **Adventures**, then **Backgrounds**, **Buildings** and **Assets** galleries.
3. Administrator moderation console inside Community.

## Technical notes

- Redirect: `HOME_PATH` in `src/lib/accounts/roles.ts` and `HomeDispatcher.tsx` point every role at
  `/`; auth pages and `next=` defaults follow. Dashboard routes remain directly reachable.
- Homepage entry: new "MyGPL Community" button beside the existing fixed homepage buttons in
  `src/pages/Index.tsx`, plus a Community entry in `ROLE_NAV` for each role.
- New additive migration (public schema, RLS + GRANTs on every table):
  `community_profiles` (user_id, unique username), `community_resources`
  (kind, owner_id, title, description, hashtags[], payload jsonb, source_id, status, published_at),
  `community_likes`, `community_downloads` (resource_id, user_id, copy_id, revoked_at) for the
  active-download count, and `community_reports` for moderation. Active downloads read from a view
  or `count(*) where revoked_at is null`.
- Classes: reuse `classes` plus a `community_shared` flag and the existing `class_join_requests`
  table and `JoinRequestsPanel` for approve/reject — no new request pipeline.
- Lesson notes: `duplicateNotebook` in `src/lib/lessonnotes/notebookCopy.ts` already produces an
  independent copy; the download path calls it and records the download link.
- Backgrounds/Buildings/Assets: today `Backgrounds.tsx` and `Assets.tsx` render shipped catalogues
  and buildings live in `profiles.homepage_config`. Phase 2 introduces per-user gallery rows so
  downloads have a real destination, then wires the homepage/building editors to read them.
- Server-side writes (publish, download, moderate) go through `createServerFn` modules so ownership
  and role checks are enforced on the server; role checks use the existing capability engine.
