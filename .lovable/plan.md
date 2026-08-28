# Share a course with Community — and copy it straight back

## The card

On each Skill Builder course card the action bar becomes:

```text
Edit · Assign to class · Duplicate · ⋯
                                     ├─ Share with Community
                                     ├─ Update listing / Unpublish (when shared)
                                     └─ Delete
```

- **View is removed** (it opened the same editor as Edit).
- Delete moves into the ⋯ menu, using the same one shared menu every other owned
  item already uses.
- A shared course shows a small **Shared** badge next to the Draft/Published badge.

## Sharing

"Share with Community" opens the existing publish sheet (title, description,
hashtags) and publishes the course as a new Community type, **Course**. It then
appears immediately in MathGPL Community under a new **Courses** section
(`/community/courses`), listed with the same read-only card style as lesson notes
and adventures.

## Copying back

Any Community member opens the shared course and presses **Copy to my workspace**.
The whole course is copied — cover, subject/topic, settings, sections, and every
video / exercise / text / conclusion block, plus each exercise's linked questions.
The copy is an independent draft owned by the copier, and the app lands them
**straight on their Skill Builder page** (`/course-builder`) with a toast naming
the new course, exactly like the lesson-note copy flow. The original is never
touched, and unpublishing later leaves existing copies alone.

## Technical notes

- `CommunityKind` gains `"course"` (label "Course", plural "Courses") in
  `src/lib/community/types.ts`.
- `CourseCard.tsx`: drop the View link, drop the inline Delete button, render
  `ShareMenu` (kind `course`, `sourceId` = course id, payload carrying
  `course_id`, subject/topic/subtopic and cover) with Delete as `onDelete`.
- `downloadResource` in `src/lib/community/community.ts` gains a `course` branch
  that calls a new `copyCourseFromCommunity(sourceCourseId, title)` in
  `src/lib/courses/api.ts` — the existing `duplicateCourse` walk, generalised so
  the read is by course id and the insert uses the current user as owner. It
  returns `{ kind: "course", courseId }`; `CommunityResourceCard.tsx` and the new
  course view page navigate to `/course-builder` on success.
- Migration (additive, no table changes): SELECT policies on `courses`,
  `course_sections`, `course_blocks` and `course_exercise_questions` allowing
  authenticated reads when the course is published to Community, reusing the
  existing `public.is_community_published` helper (via the parent course for the
  child tables). Nothing becomes anon-readable.
- New route `src/routes/community/courses/index.tsx` (+ a course detail view)
  with its own head metadata, plus a Courses tile in the community teaching hub
  sections list in `src/lib/community/mode.tsx`.
