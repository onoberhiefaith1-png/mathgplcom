# Store once, reference many — student & community access to the original course video

## What is actually broken

Nothing in the app copies video bytes today. A shared or community-copied course
already stores only the original video's storage path, so one upload = one file.

The real fault is **permission**, not duplication: the course video bucket allows
reads only inside the uploader's own folder, and the app asks for the playback
link from the browser as the signed-in viewer. So:

- Teacher (owner) → link granted → video plays.
- Student in a class the course was assigned to → link refused → video looks
  missing/blank.
- Community member who copied the course → link refused → same.

That matches what you're seeing: the teacher side works, the student side doesn't.

## What we'll build

**1. One authorised playback link service (the core change)**

A single server-side "may this person watch this video?" gate. The browser no
longer asks storage directly; it asks the app for a playback link for a video
reference, and the app answers only when the viewer is one of:

- the video's owner (teacher/uploader),
- a member of a class the course carrying that video is assigned to,
- a signed-in member viewing a course shared to Community (including a course
  they copied into their own workspace, which still points at the original file).

The link is short-lived and streams the original file. Ownership never moves.

**2. Student View Session, arranged like the teacher's**

The student surfaces (course runner, exercise question list, solving board with
the video pane) all get their video through the new gate, so:

- open course → see lesson/question → see its video → play it, audio on,
  same three-position Smartboard / Split / Video-only layout the teacher has,
- no teacher-only controls: no Add/Edit Video, no Testing Ground, no evaluation
  panel, no segment editing.

**3. Deleted-video state, no hidden copies**

If the owner deletes the original file, every reference resolves to a clear
"This video is no longer available" state on the teacher, student and community
sides. Nothing is regenerated or backed up.

**4. Teacher side untouched**

Teacher course structure, video placement, line/segment mapping and View Session
behaviour stay exactly as they are; they simply route through the same gate.

## Acceptance walkthrough

Upload one large video → add to a course → assign to a class and share to
Community → the file count in storage stays at 1 → teacher plays it → student
plays it → community member plays it (and their copy plays the same original) →
owner deletes it → all three show unavailable.

## Technical notes

- New server function `courseVideoUrl({ path })` in a client-safe
  `*.functions.ts`, with a server-only authorisation helper. Authorisation is a
  SQL security-definer function `public.can_watch_course_media(path)` covering
  owner / `course_assigned_to_my_class` / `is_community_published` (reusing the
  existing helpers), then a signed URL is minted server-side.
- `courseMediaUrl` in `src/lib/courses/media.ts` becomes: owner-path fast path,
  otherwise call the server function. `useCourseMediaUrl`,
  `QuestionVideoPane` and `StudentView` keep their current call signatures, so
  no component redesign — plus a `null` result now renders the unavailable card
  instead of an empty player.
- Migration: add read policies on `storage.objects` for `course-media` via
  `can_watch_course_media`, so class/community viewers can stream the original
  without any bucket becoming public. Nothing becomes anon-readable.
- `copyCourseFromCommunity` stays reference-only (it already copies
  `config.questionVideos[*].videoPath` verbatim); we add a comment and a test
  asserting no storage copy happens.
- Tests: authorisation matrix (owner / class member / community member /
  outsider) and a "shared course keeps the original path" regression test.

## Not included (recommended follow-up)

Adaptive-bitrate transcoding of large uploads into streaming renditions needs
external video infrastructure and is a separate piece of work; this plan keeps
the original asset streaming with HTTP range requests, which stays correct once
transcoding is added later.
