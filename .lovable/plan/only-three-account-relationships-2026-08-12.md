# Only three account relationships

MathGPL keeps three account roles — School, Teacher, Student — and only three relationships between them: School–Teacher, School–Student, Teacher–Student. Either side may send the request; the two roles decide the relationship type. Parent stays exactly as it is today (parent–child, parent–teacher, parent–school unchanged).

## What is wrong today (verified)

The connection system currently also offers same-role pairs: `teacher_teacher`, `student_student` and `school_school` exist as relationship types, the request routine accepts them, and the pairing helper in the app actively creates them when both accounts share a role. Two invalid requests already sit in the database: one student–student and one school–school, both pending.

## The correction

1. Same-role requests become impossible.
   - The request routine no longer recognises `teacher_teacher`, `student_student` or `school_school`; any attempt is refused.
   - The app's pairing helper returns "no relationship" for two accounts of the same role, so the button is never offered in the first place.
2. Discovery and Share Code reflect it.
   - In Community, a teacher browsing Teachers, a school browsing Schools, or a student browsing Students sees the profiles but no connect action — a short line explains that MathGPL only links a school with its teachers and students, and a teacher with their students.
   - Share Code / ID lookup that resolves to a same-role account says the same thing instead of failing with a code word.
3. The two invalid pending requests are deleted, so nothing references a forbidden relationship.
4. Existing valid connections, memberships, workspaces, dashboards and parent links are untouched.

## Viewing rules confirmed

These already work and are kept as the definition of "who sees what":

```text
Student opens own workspace  -> all schools, all classes, global progress
School opens a student       -> that school's classes/activity/progress only, read only
Teacher opens a student      -> only the classes that teacher teaches them in, read only
School opens a teacher       -> that teacher's shared school workspace, read only
Teacher opens own workspace  -> full control
```

The teacher's personal workspace is never exposed to the school; only the shared school-teacher workspace is.

## Technical notes

- Migration: delete the `student_student` and `school_school` rows; replace `public.request_connection` so the relation-to-roles map contains only the six valid role pairs (three role-based relationships plus the three existing parent ones) and same-role relations raise `relation_not_valid_for_these_accounts`. The enum values stay in place (Postgres cannot drop enum values safely) but become unreachable.
- `src/lib/connections/connections.ts`: drop the same-role branch from `relationFor`, remove the three same-role entries from the `Relation` union and the label map, and add a "why not" sentence helper next to `requestActionLabel`.
- `src/pages/community/CommunityDiscoverPage.tsx` and `src/components/connections/ConnectByCodeDialog.tsx`: render the explanation instead of a connect button when `relationFor` returns null.

## Verification

Signed in as a teacher, another teacher's card shows no connect button and the Share Code lookup explains why; a school and a student card still connect normally. The Requests inbox no longer lists the student–student or school–school rows.
