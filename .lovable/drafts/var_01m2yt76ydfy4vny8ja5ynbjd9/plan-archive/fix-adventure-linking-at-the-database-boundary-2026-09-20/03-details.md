## Implementation

1. **Correct the staged database change**
   - Keep a dedicated `class_adventures` relationship because no equivalent exists.
   - Enforce one link per Class + Adventure with foreign keys to the existing class and Adventure records.
   - Add class-scoped `adventure_bar_questions` placements keyed by Class + Adventure + Progress Bar + Question, using the project’s UUID question/section conventions.
   - Keep explicit authenticated/service grants, row-level security, owner write access, and class-member read access.
   - Add the per-bar pass percentage field with valid bounds, without changing or deleting existing rows.

2. **Harden link and unlink behavior**
   - Keep linking idempotent so selecting an already-linked Adventure reuses the existing relationship.
   - Return the created/existing relationship, then refresh the class list immediately.
   - Change unlinking to remove only the Class-to-Adventure link. Do not delete placements, boards, assessments, results, or the Adventure; relinking restores that class’s configuration.
   - Preserve truthful, teacher-safe errors while retaining diagnostic operation/code/message details for development.

3. **Complete the question-to-bar path**
   - Validate that the selected Adventure is linked to the selected class before a placement is written.
   - Compile mixed lesson-note questions into one independent assessment per Class + Adventure + Progress Bar.
   - Preserve repeated use of one question on different bars and strict cross-class isolation.
   - Update database typings through the project’s generated integration after the schema becomes available; do not hand-edit generated files.

4. **Prevent old-path conflicts**
   - Remove or disconnect remaining note-centric Adventure assignment calls from active Class, Lesson Note, student, dashboard, and reporting paths where they conflict with the reusable-shell model.
   - Keep historical rows readable; do not migrate, delete, or overwrite existing assignment data in this fix.

## Verification

- Static checks and focused tests for idempotent linking, multiple Adventures per class, one Adventure across classes, unlink/relink preservation, mixed-note bars, repeated questions, and class isolation.
- Browser checks for Link Adventure → immediate display, question assignment to three different bars, refresh persistence, and student visibility.
- Database checks after acceptance confirm both tables, constraints, grants, policies, and real persisted rows are visible through the application API.

## Delivery constraint

The database change is staged safely in this draft and is applied only when the draft is accepted. Until then, the preview database will continue reporting the missing table; no fake frontend fallback will be added.
