## 1. The building: two doors

`/community` keeps the rotating scene and loses the four-button strip. Two entry buttons only: **Dashboard** and **Community**. Every ring segment routes into Community (the network), never into a workspace tool. The Backgrounds / Buildings / Assets and Teaching Hub sections are removed from Community navigation and remain in the private workspace.

## 2. Community Dashboard — "My Community Space"

A dense, professional dashboard, not a grid of empty boxes:

- Header band: cover image or video, profile picture, name, headline, location, verification/status, and a single **Edit Profile** button (owner only) plus **View public profile**.
- Completeness meter that names what is missing (headline, about, experience, qualifications, intro video).
- Content shelves for what I have shared: Lesson Notes, Courses, Adventures, Live sessions, Smart Cards, Posts — each item showing views, likes, comments, published date, plus **Unshare**.
- "In my workspace, not shared" strip so I can push something out from here without leaving.
- Activity: profile views, new followers/connections, incoming and outgoing requests.

## 3. Professional profile

One profile record per account, role-shaped. The existing `community_profiles` professional bag is extended rather than replaced.

- **Teacher**: photo, cover, intro video, name, headline, about, experience entries (role, school, dates), years of experience, qualifications, degrees, certifications, subjects, specialisms, year groups, curricula, current and previous schools, location, online availability, skills, languages, portfolio and external links, achievements, shared content tabs, community activity, recommendations.
- **School**: name, logo, cover, about, location, school type, subjects, age range, student numbers, teaching approach, website, staff summary, open opportunities, shared content, live sessions, activity, contact/request.
- **Student**: name, photo, year/class, subjects, interests, learning goals, achievements, courses, activities, permitted shared work. No location, no date of birth, ever.
- **Parent**: name, photo, about, area, educational interests, connected teachers/schools (only where both sides are connected), activity.

**Ownership rule:** editing lives only on the owner's route. A visitor's view of the same profile renders view-only chrome — View Profile, Connect, Request — with no edit affordance anywhere. The database enforces this too: writes are restricted to `auth.uid() = user_id`.

**Media:** cover image or video and an introduction video, uploaded or picked from the workspace library, with the intro video shown prominently at the top of the public profile.

## 4. Shared-account rule

When a teacher is acting inside a school workspace, school-owned material can only be shared to Community by the school owner (or a member the school has granted that permission). The teacher's own personal workspace material is unaffected. This is checked in the share path, not just hidden in the UI.
