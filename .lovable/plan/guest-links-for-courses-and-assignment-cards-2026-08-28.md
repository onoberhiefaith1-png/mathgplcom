# Guest Links for Courses and Assignment Cards

Extend the Smart Card public-link concept to Full Courses and Assignment Cards. One original resource, one link, unlimited guests, nothing duplicated, and the registered student system untouched.

## What the teacher gets

- **Assignment Card** (Class → Assignments): a `Guest Link` action next to Assignment Dashboard — generate, copy, and an on/off switch.
- **Course card** (Skill Builder): a `Guest Link` entry in the card's overflow menu next to Edit / Assign to class / Duplicate / Share to Community — same generate, copy, on/off.
- Links look like the Smart Card links and are always built on the public site: `mathgpl.com/a/<code>` for an Assignment Card, `mathgpl.com/k/<code>` for a Course.
- Switching a link off makes it stop working immediately; switching back on revives the same code.

## What the guest gets

1. Opens the link — no sign-in, no registration, no class, no join code.
2. A single lightweight welcome panel: optional name box with a **Continue as guest** skip (auto label such as "Guest 4F2A" when skipped).
3. Straight into the real activity:
   - Assignment Card → the existing question board, all questions, instant automatic marking, then an instant result summary.
   - Course → the existing Student View: sections, videos (streamed from the original asset), and exercise questions with instant marking.
4. A result screen with the score and a **Visit MathGPL** call to action.
5. No student dashboard, no profile, no long-term record, no navigation into the platform.

## Guests stay guests

- Guest attempts are stored in their own tables, keyed by the browser guest token — never in `assessment_progress`, `class_members`, `student_course_progress`, or any student table.
- Even a signed-in student who opens a guest link is recorded as a guest for that attempt; entry route decides participant type.
- Class averages, completion percentages, assignment progress and student lists are unchanged by guest activity.

## Guest reporting (deliberately mini)

- A **Guests** tab beside **Students** on the class report and on the Assignment Dashboard, plus a Guests panel on the Course.
- Shows only: guests, average score, highest score, average completion, and a short list of recent attempts (name/label, score, time).
- Never merged into student figures.

## Technical notes

Data (one migration, grants + RLS in the same migration):
- `guest_links`: `id`, `resource_kind` (`course` | `assessment`), `resource_id`, `owner_id`, `slug` (unique, same 4-char alphabet as `generateSlug`), `enabled`, `created_at`. Owner-scoped SELECT/INSERT/UPDATE for `authenticated`; no `anon` policy (public reads go through the server, not PostgREST).
- `guest_attempts`: `id`, `link_id`, `resource_kind`, `resource_id`, `guest_token`, `display_name`, `score`, `total_marks`, `completion_pct`, `status`, `started_at`, `finished_at`. Owner reads via the link's `owner_id`; writes only through the server.
- `guest_attempt_answers`: per-question marks for a guest attempt so the result screen and completion percentage are real, not estimated.

Server (TanStack, no new edge functions):
- `src/routes/api/public/guest/$slug.ts` — resolves an enabled link and returns the original course tree or assessment questions with the answer key stripped. Uses `supabaseAdmin` loaded inside the handler; validates input with Zod.
- `src/routes/api/public/guest/attempt.ts` — POST: start attempt, submit a graded line/question, finish attempt; returns the running score. Rate-limit-friendly, no PII returned.
- Guest grading reuses the existing marking path (`grade-line`), attributed to the link owner exactly as student marking is today, so guests are never asked to pay and never blocked by credits.
- `src/lib/guests/guestLinks.ts` (teacher side: generate/toggle/copy, `guestCourseUrl`, `guestAssignmentUrl` built from `publicOrigin()`) and `src/lib/guests/guestSession.ts` (guest token + optional name, reusing `src/lib/live/guest.ts` helpers).

UI:
- New public routes `src/routes/k/$slug/index.tsx` (course) and `src/routes/a/$slug/index.tsx` (assignment), each with its own `head()` metadata; both wrapped in a light guest shell modelled on `AudienceShell`.
- The guest course view renders the existing `StudentView`; the guest assignment view renders the existing `PresentationView` board via `buildAssessmentBoardSource`, in guest mode (no teacher controls, no class calls).
- Teacher additions are additive: a `GuestLinkDialog` used from `ClassAssignmentsPage.tsx` and `CourseCard.tsx`; existing actions unchanged.

Content is never copied: guest views read the original course/assessment rows and stream the original `course-media` paths through the existing store-once permission function, extended to allow guest-link viewers of that resource.

## Out of scope

- No changes to Smart Card links, the student flow, or Community sharing.
- No guest accounts, guest history, or guest logins.
- No adaptive-bitrate transcoding.
