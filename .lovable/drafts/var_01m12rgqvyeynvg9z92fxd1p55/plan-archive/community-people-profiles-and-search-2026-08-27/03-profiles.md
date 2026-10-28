## Community profile — edited in the workspace

A "Community profile" editor lives in the Individual Workspace; Community only displays it. Every field is optional, with a completeness meter and one master switch: **List me in Community**. Nothing shows publicly until that switch is on.

Sections, adapted per role:

- **Basic** — photo, full name, username, professional headline, location, country, short bio.
- **Teacher** — qualifications, degrees, institutions, subject specialisation, teaching level, curriculum experience, years of experience, current and previous roles, areas of expertise, skills, certifications.
- **School** — school type, location, levels, subjects, programmes, description.
- **Student** (privacy-first) — display name, educational level, subjects, learning interests, achievements. No location, no age, photo only if explicitly allowed.
- **Parent** — location, educational interests.
- **Community stats** (read-only, computed) — shared lesson notes, courses, adventures, smart cards, live rooms, classes, connections, views, likes.

## Compact result versus full profile

A search result shows a compact public summary only:

```text
(photo)  Faith Gabriel
         Mathematics Teacher
         Nigeria / United Kingdom
         MA Education & Technology
         Mathematics · Secondary Education · AI in Education
         1.2K views · 85 likes
         [ View profile ]   [ Request ]
```

**View profile** opens `/community/people/:username`: hero (large photo, name, title, location, bio, Connect/Request), then About, Education, Qualifications, Experience, Subjects, Skills, and that person's shared Lesson Notes, Courses, Adventures, Classes, MathGPL Live and Smart Cards, built from their existing published Community listings. Views count on the full profile, not on cards.

## Directories and filters

`/community/teachers`, `/community/schools`, `/community/students`, `/community/parents` — one grid, filters tuned per group:

- Teachers: subject, level, location, experience, qualification, has courses / has live sessions / has lesson notes.
- Schools: location, school type, subjects, levels.
- Students: subject interests, level, learning interests.
- Parents: location, educational interests.

Global search returns mixed results grouped as People and Content, with tabs to narrow to one group.

## Request and connect

Community reuses the existing connection system rather than a second one, so a Community request lands in the same requests inbox people already use: Student → Teacher, Parent → Teacher, Teacher → School, Parent → School, Student → School. Button state reflects reality — Request, Pending, Accepted, Declined, Connected. Someone who has turned requests off shows no Request button.

## Publishing safety

Profile text and photo pass an AI safety check at publish time — when listing is switched on, or when public text or photo changes. Rejection is explicit ("Cannot be published — this violates the Community content policy"), names the offending field, and leaves the profile unlisted. Video copyright checking belongs to the Feed phase.

## Left for the next phases

Community Feed posts, hashtag auto-suggestion with item counts, showcase/promotion of educational apps and games, and video copyright checks — deliberately deferred so this phase lands reviewable.

## Technical notes

- **Database (additive, applies when you accept this draft):** new public columns on `community_profiles` — `is_listed`, `role_kind`, `headline`, `location`, `avatar_url`, `bio_long`, `years_experience`, a jsonb `professional` blob (qualifications, roles, skills, certifications, subjects, levels, interests, achievements, school fields), `moderation_state`, `view_count`; plus `community_profile_views` for de-duplicated view counting. Grants and RLS per table, with an owner-scoped SELECT policy so an unlisted profile is still readable by its owner in the editor.
- **Reads:** `community_directory(...)` and `community_public_profile(username)` security-definer RPCs return only `is_listed = true` rows with a safe projection (never a student's location or date of birth), so anonymous discovery cannot walk `profiles`.
- **Requests:** `src/lib/community/requests.ts` wraps the existing `connections` table (`connection_relation` already covers teacher_student, parent_teacher, school_teacher, parent_school) and `my_connection_counts` for state — no new request table.
- **Code:** `src/components/community/CommunityShell.tsx`, `src/pages/community/CommunityDashboard.tsx`, `DirectoryPage.tsx`, `PersonProfilePage.tsx`, `src/components/community/PersonResultCard.tsx`, `src/lib/community/people.ts`, and the workspace editor `src/pages/profile/CommunityProfileEditor.tsx`. New routes under `src/routes/community/`: `dashboard`, `teachers`, `schools`, `students`, `parents`, `people/$username`, `search`. Existing section routes keep their paths and are wrapped by the shell.
- **Moderation** runs in a server function through the Lovable AI gateway on save, and the result is stored on the row so a pass is not re-checked on every read.
- **Tests:** directory visibility rules (a student's private fields never leave the RPC shape), request-state mapping, profile completeness.
