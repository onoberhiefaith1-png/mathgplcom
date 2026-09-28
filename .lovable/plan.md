# Academia refinement: identity, navigation, session experience

Student Academia is not part of this phase. Nothing that already works (Classes, Subjects, assignments, Topics, Subtopics, Sessions) gets rebuilt. It stays separate from the 3D Building.

## 1. School identity on Academia
- A header strip at the top of every Academia page with the school's own logo and name (from the existing School Profile), a cover picture, and a public description.
- New Academia settings let the School set a cover picture, a presentation picture and a description. If no logo or cover is set, a tidy default shows instead.
- Teachers in the school's Shared Workspace see the same header, but read-only. Only the School can edit it.

## 2. Teacher Quick Action and workspace context
- In the Teacher Quick Action group, Courses is replaced by **Academia**. Courses stays everywhere else.
- In a school's Shared Workspace, Academia opens that school's Academia straight away. In the Personal Workspace, it opens the teacher's own **Personal Academia**. This uses the same structure, owned by the teacher's personal workspace, and the teacher builds everything in it, including Classes and Subjects. A teacher can never land in the wrong school's Academia.

## 3. Persistent left navigation
- Every Academia page (overview, session) sits inside the existing foldable workspace sidebar, plus a clear Back link. Nobody gets stuck inside a session.

## 4. Session page redesign (following the reference screenshot)
- Header: a trail (Academia > Class > Subject > Topic > Subtopic), then the Topic name small above, the Session name large, and a description.
- Session tabs show the teacher's real session names (never "Session 1"). The current one is highlighted, and the row scrolls sideways when there are many.
- Layout: a compact video panel on the left (about 25%) and a large Activities area on the right (about 75%).
- Video panel: one video per session, with a thumbnail, play button, title, description, and Replace video / Edit details buttons.
- Video thumbnail: upload your own, capture a frame from the video, or **Generate with AI** using Topic + Subtopic + Session name. If none is chosen, the video's first frame is used.
- Activities become a horizontal card carousel with left/right arrows and no limit on how many. Each card shows its number, difficulty badge, thumbnail, a short preview of the task, a status (Not started / In progress / Completed) and a Continue / Review / Play button.
- Activity thumbnail: upload your own, or **Generate with AI** from the activity's actual question or task.
- The carousel remembers each person's last position in each session and returns there next time. The arrows always still work.
- Smaller screens show fewer cards but keep sideways movement. Cards never stack into a long list.
- Play and Practice open the existing Game and Smartboard. No new engine.

## 5. Permissions (unchanged model)
- The School manages its profile, settings, Classes, Subjects and teacher assignments.
- Teachers manage Topics, Subtopics, Sessions and Activities in their assigned Subjects, including video, thumbnails and activity pictures.

## Technical section
- Migration (additive): `academia` gains `cover_path`, `presentation_path`, `description`, plus a nullable `owner_kind` so personal workspaces are covered. `ensure_personal_academia(org)` is added for personal-workspace owners. `academia_sessions` gains `description`, `thumbnail_path`. `academia_activities` gains `thumbnail_path`. A new `academia_session_positions` table (user_id, session_id, activity_index, updated_at) has GRANTs + RLS limited to the owner. A private storage bucket `academia-media` gets RLS that uses the existing builder/owner helpers.
- School logo and name come from `organizations`, read through the existing profile helpers.
- AI pictures come from a `createServerFn` in `src/lib/academia/thumbnail.functions.ts`, which reuses the pattern of the existing lesson-note/game cover generator (Lovable AI image model) and saves the picture to `academia-media`. It runs through credit metering like the other covers.
- Frame capture runs in the browser: a `<video>` element draws to a canvas and the result is uploaded (works for uploaded or direct video links; YouTube uses its own poster image instead).
- New components: `AcademiaHeader`, `SessionVideoPanel`, `ActivityCarousel`, `ActivityCard`, `ThumbnailPicker` (Upload / Capture frame / Generate with AI). Pages get wrapped in the existing workspace sidebar shell.
- Quick Action change is in the teacher dashboard's quick-action list only. `TeacherAcademiaPage` branches on workspace kind: school → shared Academia, personal → Personal Academia.
- AGENTS.md rule update: Academia is scoped per workspace (school or personal) and never mixes.

## Verification
- Sign in as school and as teacher (shared and personal). Check the header, Quick Action destination, sidebar on session pages, real session names, the video about 25% wide, the carousel arrows, thumbnail upload/AI, and that position is remembered after leaving and coming back.
