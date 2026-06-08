## Post-Join-Class Refinement Phase

Six corrections to the existing classroom system. No homework/assessments. No redesign — only the fixes below.

---

### 1. Move Join Class inside Classes

- **`TeachingHub.tsx`** — remove the standalone "Join a Class" tile. Tiles become: Lesson Notes, SmartBoard, Classes, Settings.
- **`TeachingHubClasses.tsx`** — render two side-by-side panels:
  - **Left:** "Create Class" (existing link/card to `/teaching-hub/classes/create`).
  - **Right:** "Join Class" — embed the join UI (join-code + invite-link entry, pending-request banner, invitations, MathGPL ID) directly here.
- Extract the join logic/UI from `JoinClassPage.tsx` into a reusable `JoinClassPanel` component used by both the Classes page (right panel) and the existing `/join/:code` route (kept for invite links). "Your Classes" list stays below the two panels.

### 2. Classes works without Lesson Notes

- Audit and remove any redirect that pushes a user toward Lesson Notes when opening Classes. Classes/Create Class must open with zero notebooks and zero smartboards.
- Copy fix: where the app currently says "Add notes… first" / implies a note must be created, show **"No lesson note selected."** instead. Files: `ClassSmartBoardLauncher.tsx` empty state, `StudentClassPage.tsx` notes empty state.

### 3. Real-time access changes (no refresh)

- **`StudentClassPage.tsx`** — subscribe to `class_lesson_notes` (filter `class_id`) so note grant/removal and visibility toggles update the student's notes list live.
- **`StudentSmartBoardPage.tsx`** — in addition to the existing `class_smartboard_state` subscription, subscribe to `classes` row (smartboard_visibility) so SmartBoard access grant/removal applies instantly. When access is removed, drop back to the "no access" state immediately.
- Migration: ensure `class_lesson_notes`, `classes`, and `class_smartboard_state` are in the `supabase_realtime` publication.

### 4 & 5. Student SmartBoard mirrors the real board (view-only)

- **Do not** keep the text-only `ReadOnlyNotebookView`. Render the actual `PresentationView` for students.
- Add a `mode` prop to `PresentationView`: `"teacher"` (default, current behaviour) | `"mirror"` (student).
- **Sync layer** (reuse existing `class_smartboard_state.state_json jsonb`):
  - Teacher board (launched with `?classId=`) serializes its presentation state — `beatCursor`, `bandExtra`, `freeLines`, `lineOffsets`, `smartLines`, `boxes`, `sensor`, `zoom`, `surface` — and upserts it (debounced) into `state_json` on change.
  - Student mirror reads `state_json` via realtime and applies it to the same state instead of localStorage; it does not persist locally.
- **Mirror mode = view-only:** disable the writing surface, keyboard input, eraser, assistants, navigation arrows, settings — all editing/control chrome hidden. Student only watches; scrolling allowed.

### 6 & 7. Active Student control

- Migration: add `active_student_id uuid` (nullable) to `class_smartboard_state`.
- **Teacher PresentationView** gains an "Active Student" control:
  - Opens a list of approved students (`class_members` joined to `profiles`).
  - Selecting Student A sets `active_student_id = A`. Selecting Student B replaces it (A loses rights instantly). Deselect / "Take back control" clears it.
  - Teacher always retains edit rights regardless.
- **Student mirror** subscribes to `active_student_id`. When it equals the current user, the mirror switches from view-only to **editable**: that student may move through the presentation, reveal lines, work solutions, and use board tools — and their changes broadcast back into `state_json` (same upsert path as teacher).
- The moment `active_student_id` changes away from them, editing rights disappear instantly (back to view-only), no refresh.
- Write model: only teacher + the single active student can write `state_json`; last-write-wins is acceptable since at most two editors exist.

### 8. Out of scope

No homework, assessments, quizzes, or per-student answer collection.

---

### Technical notes

- `class_smartboard_state` already has `state_json jsonb`; only `active_student_id` is added.
- RLS: teacher (class owner) can write state + active_student_id; approved members can read; the current active student can write state. Add/adjust policies in the migration and keep GRANTs intact.
- Realtime publication additions are idempotent in the migration.
- `PresentationView` is large and localStorage-driven; the cleanest approach is a small `useSmartboardSync(classId, role)` hook that (a) for teacher/active-student pushes a serialized snapshot on state change, (b) for viewers applies incoming snapshots, gating the local persistence effects when `classId` is present.

### Validation

Teacher creates class → approves 3 students → launches SmartBoard → all students see the identical board. Grant/remove note access reflects instantly on students. Select Student A → A can edit, B cannot. Select Student B → A loses rights, B gains them. Teacher always retains control.