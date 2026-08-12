# Student accounts: correct sign-up, correct ID, own workspace, school ownership

## What is actually broken

Verified in the database: the three most recent sign-ups were created with the wrong account type.

| Email | Chose | Got |
|---|---|---|
| gabrielonoberhie381@gmail.com | Student | Teacher, `TCH/000010` |
| faithgabrielonoberhie2@gmail.com | Parent | Teacher, `TCH/000011` |
| faithonoberhie1@gmail.com | School | Teacher, `TCH/000006` |

Cause: nothing runs at account creation any more that reads the account type the person picked, so the first thing that touches the new account issues an ID with the fallback type "teacher" and writes "teacher" as the account's role. From then on the account is a teacher everywhere — which is exactly what you saw when logging in as a student. The sign-up screens themselves are correct; the account-creation step is where the choice is lost.

## Fix 1 — the chosen account type decides everything (do first)

- The chosen type travels with the account creation request and is what issues the ID and the role, so Student gets `STU/…`, Parent `PAR/…`, School `SC/…`, Teacher `TCH/…`. The "teacher" fallback is only used when there is genuinely no choice recorded, and it can never overwrite a type that was chosen.
- Only the four public types can ever be self-assigned; administrator stays impossible to obtain by signing up.
- The confirmation email keeps its current design and now carries the real student ID with student wording ("This is how you log in") — the same email engine, no new templates.
- Repair the three accounts above: give each the type it chose and a correct new ID (`STU/…`, `PAR/…`, `SC/…`), retire the wrongly issued `TCH` numbers, and create the school container for the school account. Then logging in with the student ID opens the student side.

## Fix 2 — the student workspace

- A student's homepage is the building only, with a single **Join Class** entry at the front — no top bar, no settings, no tools. That is already the student view; it stays.
- **Join Class** opens the student's class page inside their own workspace: the classes they belong to, and the code box to join another.
- Everything else a student reaches (a class, its lesson notes, adventures, assignments) is view-and-do only: they can answer, play and submit, never edit a teacher's material.

## Fix 3 — school owns its students, exactly like it owns its teachers

- School Console gains **Students** alongside Teachers: every student belonging to the school, and **View Workspace** opens that student's own workspace read-only, through the same mirror already used for teachers ("You cannot make changes here").
- A student joining a class of a school becomes a student of that school.
- A class that belongs to a school can only be joined by students of that school. A student outside the school is refused with a clear sentence: this class belongs to {School} and only its students can join. Classes owned by an independent teacher (no school) keep working for anyone with the code.
- A teacher inside a shared school workspace therefore only ever teaches that school's students; the teacher's own personal classes are unaffected.

## Technical notes

- Account creation: re-establish role assignment at sign-up so `user_roles` and `account_ids` are written from the chosen type. `issue_account_id` stops defaulting to `teacher` when a chosen type is available, and the post-sign-up ID lookup passes the chosen type instead of relying on the fallback. `ensure_account` keeps self-healing older accounts but must never downgrade a real type.
- Repair migration: reissue `account_ids` rows for the three users from their `raw_user_meta_data.account_role`, replace their `user_roles` rows, and create the missing school organization + membership. Additive only; no rows deleted beyond the incorrect role/ID rows being replaced.
- Student membership: `class_member_enrols_workspace` already enrols joiners into the class's org — keep it, and add the reverse check in `class_join_gate` so a school class returns `allowed = false` for non-members, with the class page showing the school-specific refusal message.
- School → student mirror: reuse `ViewAsProvider` / `viewAsScope` and the `/school/students/$userId` route already present, pointing at the real student pages instead of a separate read-only design.
- Student pages continue to use `withOwnerView`-scoped reads; no new tables.

## Verification

Sign up as a student, confirm the email shows `STU/…` with student wording, log in with that ID and land on the building with only Join Class, open the class page, join a school class as a school student (works) and as an outside student (refused with the school message), then open that student's workspace from School Console → Students and confirm every edit is refused.
