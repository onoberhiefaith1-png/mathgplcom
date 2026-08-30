## 1. Ranking, not alphabet

People lists (Teachers, Schools, Students, Parents) get a **prominence score** computed on the server, so the most active and most followed people appear first. Score inputs, each capped so no single number dominates:

- students taught / class members
- shared listings (lesson notes, courses, adventures, classes)
- likes and downloads received on shared content
- posts, comments and interactions
- profile views
- live sessions taught

Ties fall back to name. The search bar and the sidebar fields stay purely a **filter** over that ranked list — they never change the order rule.

## 2. Teacher discovery card

The plain database-style card is replaced with a preview card: cover image or video, avatar, name, role line, then at most four proof points (students taught, years experience, subjects, shared counts) and one **View Profile** action. Schools, students and parents get the same card with role-appropriate proof points; students never show location.

## 3. Public Personal Dashboard

Clicking a card opens that person's dashboard in public read-only mode — the same ownership data, presented as "Teacher X's MathGPL space": profile header, then Lesson Notes, Courses, Adventures, Classes, MathGPL Live, each listing only what they shared. No edit controls, and each item keeps its "Created by" link plus **Copy to My MathGPL** where the resource type supports it.

## 4. Separate the two shells

- **Personal Dashboard** loses every discovery entry (Teachers, Schools, Students, Parents, global Community search). It becomes an ownership shell: My Profile, My Lesson Notes, My Courses, My Adventures, My Classes, My MathGPL Live, My Shared Content, My Activity — with its own header treatment so it never reads as Community.
- **Community** becomes search-first: a large search bar above categorised results (People / Learning), a live rail, and the discovery navigation. Distinct header, distinct hierarchy.

## 5. Live Now

Live Now is presented as a live discovery strip — red live dot, teacher, subject/topic, Join Live — not a static content grid.

## Nothing else changes

Routing, auth, ownership, public/private visibility, lesson note / course / adventure / class relationships and the existing request pipeline are reused as-is. No new parallel ownership data is created for Community: it keeps reading from owners' shared listings.

## Technical notes

- New security-definer function returning a `prominence` score alongside the existing directory projection; the existing `community_directory` keeps working, and the ranking is added as a staged additive migration (applies on accept).
- `src/lib/community/people.ts` sorts on the returned score; `applyDirectoryFilters` stays the filter layer.
- `PersonResultCard.tsx` rewritten as the preview card; `CommunityShell.tsx` split into a Community discovery shell and a separate dashboard shell so the two navigations diverge.
- `CommunityPersonPage.tsx` becomes the public dashboard view, reusing existing resource cards in read-only mode.
