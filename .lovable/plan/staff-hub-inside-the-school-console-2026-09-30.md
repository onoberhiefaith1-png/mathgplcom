# Staff Hub inside the School Console

Bring your separate **Staff Hub** project into MathGPL as a School feature. The school owner (and any teacher made a **Manager**) assigns tasks to the school's own teachers; teachers deliver them in real time; the school gets reliable information to judge performance. Nothing that exists today in MathGPL is changed.

## What already exists (checked)

- **Staff Hub project**: one shell with Overview, Team, Availability, Tasks (new / detail), Projects, Goals, Reports, Feedback, Notifications, Settings; AI Insights, AI Learning and Messages are placeholders. Every action (assign, start, submit proof, review, request more time, change deadline, availability, set role) is a single safe database action that also writes a notification and a work event. Its pages and styling will be copied across; its database design will be re-created here, because the copy I can read does not include it.
- **MathGPL School Console**: left nav has Dashboard, Academia, Teachers, Students, Reports, Pricing. Teachers are linked to the school through the shared workspace, and Subjects are already assigned to teachers in Academia.

## How it will work

```text
School Console
  └── Staff Hub
        Overview · Team · Availability · Tasks · Projects · Goals
        Reports · Feedback · Notifications · Settings
```

- **Who can be given tasks**: only teachers connected to this school's workspace. No new accounts, no duplicate people — the same MathGPL teacher.
- **Three levels**: Administrator (school owner), Manager, Staff (every connected teacher). The owner can make any teacher a Manager or remove it. Managers can do everything the owner does in Staff Hub — assign, edit, change deadlines, review proof, approve availability and extensions, see reports. Billing, plans and account ownership stay owner-only.
- **Where teachers see it**: a "School tasks" entry inside that school's teacher workspace, opening "My tasks" (what's due, start, submit proof, ask for more time, comment). A teacher never sees another school's tasks.
- **Task lifecycle**: Assigned → In progress → Submitted → Approved or Changes requested → Completed; plus Overdue and Extension requested. Deadlines can be a date, date and time, or flexible.
- **Real time**: task boards, comments and notifications update live without refreshing.

## Professional touches I'm adding

- **Link a task to MathGPL work**: optionally attach a Subject/Topic/Session, a lesson note, a Game or an Assignment, so "Create four Standard Deviation activities and assign them in Academia" opens straight to the right place.
- **Evidence from MathGPL itself**: the task page shows real events that happened on the linked item (note created, activities added, game updated, assigned to students) next to the uploaded proof — facts, not click-tracking.
- **Task templates** for repeated jobs (weekly lesson notes, marking, report writing).
- **Workload view**: hours assigned vs availability per teacher, warning before overloading someone.
- **Performance report per teacher and per period**: on-time rate, average review rounds, extensions asked, tasks completed, feedback given — plus a printable/exportable summary for appraisals.
- **Audit trail** on every task: who assigned, changed deadline, approved, and when.

## Delivery in phases

1. **Foundation** — Staff Hub in the School nav, roles (Admin/Manager/Staff) drawn from the school's connected teachers, Team page, Manager toggle.
2. **Tasks** — create/assign to one or many teachers, deadlines, resources and files, start, submit proof, review, extensions, comments, notifications; teacher "My tasks".
3. **Availability, Projects, Goals** — as in Staff Hub, plus the workload view.
4. **Reports and MathGPL links** — task links to Academia/lesson notes/games/assignments, work-event evidence, per-teacher performance report, export.
5. **Staff Hub AI (later, separate plan)** — the brief's AI Insights, AI Learning and weekly summaries, built only on the real work events above. Kept separate so costs stay controlled.

## Technical details

- New tables, all prefixed `staff_` to avoid clashing with existing `notifications`, `user_roles`, `profiles`: `staff_roles` (org_id, user_id, role admin|manager), `staff_projects`, `staff_goals`, `staff_tasks` (org_id, links to academia session / notebook / game / assessment nullable), `staff_task_assignees`, `staff_task_resources`, `staff_task_submissions`, `staff_task_comments`, `staff_task_feedback`, `staff_extension_requests`, `staff_availability`, `staff_work_events`, `staff_task_templates`. Each with GRANTs, RLS on, scoped by org.
- Helpers: `staff_is_manager(org)` (owner or manager row), `staff_is_member(org)` (active teacher membership in `account_memberships`). All workflow actions are SECURITY DEFINER functions ported from the Staff Hub actions, writing `staff_work_events` and notifications through the existing MathGPL notification system.
- Private storage bucket `staff-hub-files` under `<org_id>/`.
- Routes: `/school/staff-hub/*` (owner + managers; a manager teacher gets access to these pages through the manager check, not the school role) and `/teaching-hub/school-tasks/*` for staff. Pages and `panel.tsx` primitives copied from the Staff Hub project, re-themed with MathGPL tokens; realtime on tasks, comments and submissions.
- AGENTS.md gets the Staff Hub rules; roadmap.md tracks the phases.
