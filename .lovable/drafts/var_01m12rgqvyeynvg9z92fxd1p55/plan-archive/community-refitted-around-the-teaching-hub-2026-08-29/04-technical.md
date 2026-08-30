## Technical notes

**Reference model.** `community_resources` already stores `owner_id`, `status`, `published_at` and `source_id`, and `CommunityNoteViewPage` already resolves the original `notebooks` row — that stays the pattern. Any remaining `payload` snapshot fields become cover/label hints only; the authoritative read is always the original asset resolved through `source_id`.

**Courses.** Add `"course"` to `CommunityKind`/`COMMUNITY_KINDS` in `src/lib/community/types.ts`, wire `PublishDialog`/`ShareMenu` into the Teaching Hub course view, add a `CommunityCourseViewPage` that loads the original `courses` row plus sections/blocks by `source_id`, and a `/community/courses` browse route. Course media keeps resolving through the existing `src/lib/courses/media.ts` / `useCourseMediaUrl` path against the owner's original object; a narrow public read policy for published courses and their media rows is staged as an additive migration, no media copying.

**Community Dashboard.** `MyCommunitySpacePage` and `CommunityPersonPage` share one grouped-sections component driven by published listings for a given `owner_id` (owner variant adds Unpublish, visitor variant is read-only). Add an "optional presence" branch: zero published listings → an explicit empty state (visitor side: a "no public presence yet" page rather than an empty dashboard).

**Main Community.** Replace `CommunityNetworkPage`'s box grid with a feed page composed of rails (`FeaturedRail`, `LiveNowRail` reused, `RecentlySharedRail`, per-kind rails, people rails) plus an infinite `useInfiniteQuery` stream over published listings ordered by `published_at`, and prominence ordering reused from `src/lib/community/people.ts` for the people rails. `CommunitySectionPage` remains the "View all" target per kind.

**Shells.** `CommunityShell` (discovery) and `PersonalDashboardShell` (ownership) stay separate; the Community rail gains Courses, and no discovery links leak into the Teaching Hub side.

**Schema timing.** New enum value/policies for published courses are staged as an additive migration in this draft and apply when the draft is accepted; course publishing can only be exercised after that. No table, column or policy is dropped.

**Build order.** (1) shared grouped-sections Community Dashboard + optional-presence states, (2) course publish path and public course page, (3) Main Community feed refit with rails and infinite stream, (4) card polish, badges and filters.
