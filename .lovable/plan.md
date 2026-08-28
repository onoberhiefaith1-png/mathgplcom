# Guest Link — video split screen, real marking, and live guest viewing

Three gaps in the Guest Link experience, in the order they must be fixed.

## 1. Marking must actually happen (diagnose first)

A guest solved a question and nothing was marked. The marking engine already
has a guest branch that writes to `guest_attempts` and authorises the visitor
by the link (not by class membership), so the failure cause is not yet
confirmed. First step is to reproduce it: open a guest link, solve one line,
and read the marking engine's response and logs.

Likely candidates to check in that order:
- the marking call being rejected before it runs, because a guest has no
  signed-in session to send;
- the guest's exercise card not matching the link (course/assignment
  ownership check returning a mismatch);
- the board never sending the guest identity for the assignment path.

Only after the response is read will the fix be applied. No blind repair.

Alongside the fix: on opening the board, seed the guest's already-earned marks
from their own attempt row so returning guests see their score, and surface a
clear inline message when marking fails instead of silently doing nothing.

## 2. Teaching video + split screen for guests

Students already get the three-position layout (Smartboard only · Split view ·
Video only) with the video timeline synchronised line-by-line to the solution.
Guests get none of it, because the video record and the media signing both need
access a guest does not have.

- The guest exercise response gains the question's video record (the single
  original video path plus its line ranges). Nothing is duplicated; the path
  is a reference to the original object.
- The guest board renders the same three-view frame and the same layout
  switcher as the student board, and only when the teacher actually attached a
  video to that question. Questions without video look exactly as they do now.
- The video itself is streamed through the guest link's own signed-media
  endpoint, so playback works with no account.
- The line list stays strictly one-to-one with the numbered solution lines, the
  same as the student side — no re-mapping for guests.

## 3. "Live guests" — the teacher can watch guest work in real time

The Guest link panel (active link · ask for a name · Guest Performance) gains a
**Live guests** button.

- Opening it lists every guest currently working on that link: their name (or
  "Guest"), which question they are on, their score so far, and how long they
  have been active. Guests who have finished or left drop to a "Recent"
  list below.
- Selecting a guest opens their board read-only, updating live as they write —
  the same viewing experience the teacher already has for students, including
  their marks appearing as the engine awards them.
- Nothing the teacher does there can alter the guest's work, and guests remain
  entirely outside class rosters and student progress.

## Technical notes

- `src/routes/api/public/guest/$slug.ts`: add `action=video&blockId&questionId`
  returning the stored `course_blocks.config.questionVideos[questionId]`
  record; keep the existing course-scope check on the block. Media continues
  through `action=media`.
- `src/pages/guest/GuestCoursePage.tsx` and `GuestAssignmentPage.tsx`: mount
  `ThreeViewFrame` + `BoardViewSwitcher` (`useBoardVideoView`) around
  `PresentationView` when a video record exists, mirroring
  `src/pages/student/AssessmentBoardPage.tsx`.
- Marking: reproduce via the guest board, then read the `grade-line` response
  and logs. Verify the function accepts an unauthenticated invoke (guest mode
  intentionally skips the JWT path) and that
  `kind = "course_exercise_guest"` / assignment link checks pass. Seed marks
  from `action=progress` into `solvedSlots` on mount.
- Live presence: new `guest_presence` table (`link_id`, `guest_token`,
  `guest_name`, `assessment_id`, `question_id`, `score`, `last_seen_at`) with
  RLS allowing the link owner to read and the public guest endpoint
  (`action=heartbeat`, service role) to upsert. Guest board sends a heartbeat
  on question change and on a short interval.
- Teacher viewer: extend `GuestLinkDialog.tsx` with a Live guests drawer that
  polls/subscribes to `guest_presence` for the link and opens the existing
  read-only board viewer for the selected guest's `assessment_id`, reading
  their `guest_attempts.solved_lines` for marks.
- Student, class, Smart Card and Community flows are untouched.
