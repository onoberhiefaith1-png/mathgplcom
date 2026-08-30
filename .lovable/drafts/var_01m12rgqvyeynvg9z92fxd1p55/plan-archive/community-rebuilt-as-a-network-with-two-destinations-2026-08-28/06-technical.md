## Technical notes

**Routing.** `/community` keeps the rotating scene with two entry buttons. `/community/dashboard` becomes *my* space (moving the current people-discovery landing to `/community/network`), `/community/network` becomes the network landing, and today's directory, search, person, note, adventure, live and section routes re-parent under it. The Community copies of the building, backgrounds, buildings, assets and teaching-hub routes are removed; those live in the private workspace. A shared Community shell provides the sidebar, search bar and mobile drawer for every network page.

**Profile.** Extends the existing `community_profiles` row and its `professional` JSON bag with structured experience/education/link entries plus cover media and intro-video fields. Owner reads and writes go through the table under `auth.uid() = user_id`; public reads keep going through the existing security-definer directory/profile functions so unlisted rows and private fields (student location, dates of birth) cannot leak.

**Feed.** New tables for posts and comments, with likes and view counts, hashtag rows for suggestion counts, RLS scoped so authors write their own rows, readers see published rows, and the Administrator moderates. Every new public table ships explicit grants.

**Live.** Reads the existing session/`is_live` and public-audience paths; Community adds no live infrastructure of its own.

**Sharing.** Reuses the existing publish/share dialog and `community_resources` records. The school-account restriction is applied where a publish is written, using the existing account/permission engine.

**Schema timing.** The database changes are staged as an additive migration in this draft and apply when the draft is accepted; the feed and the new profile fields cannot be exercised in the draft preview before that.

**Suggested build order.** (1) building split and route re-parenting, (2) Community Dashboard and the owner/visitor profile split, (3) network landing with real Live-now data plus directories and search, (4) feed, posts, comments and hashtags, (5) promotions and polish.
