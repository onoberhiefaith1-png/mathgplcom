# Join Class Hardening Plan

The rebuild already landed Phases 3, 4, and 6 (RLS firewall, `/join` route, participant `/student/class/:classId` dashboard). This plan closes the gaps between what exists today and the strict participant-portal spec, then runs the two-account isolation test.

## What is already correct
- `/join` route exists and is participant-only (Join Code, Invite Link, MathGPL ID display, Previous Classes).
- Pending requests auto-redirect on approval via realtime on `class_members`.
- `/student/class/:classId` enforces an identity firewall (must be in `class_members`), shows only SmartBoard link + released Class Notes, no owner UI.
- All helper RPCs revoked from `anon`; class data cannot be probed without login.
- RLS audit confirms `classes`, `class_members`, `class_lesson_notes`, notebook tables, etc. are scoped to owner OR member only.

## Gaps to fix

### 1. Owner approval inbox (Create Class side)
The old `InvitationsInboxPage` was deleted with the Join Class teardown, so right now there is no UI for an owner to approve/reject pending `class_join_requests`. Without it the participant is stuck on "Waiting for approval" forever.

Build a new owner-only surface inside the existing Create Class ownership UI (not on `/join`):
- New section on `ClassDashboardPage` (owner-gated by `ensureClassOwner`) listing pending rows from `class_join_requests` for that class.
- Approve action: insert into `class_members`, mark request `approved`. Reject action: mark request `rejected`. Both via existing RLS — owner-only.
- Realtime refresh of the pending list so the owner sees new requests live.

### 2. MathGPL ID invitation path
Spec lists three entry methods: Join Code, Invite Link, **MathGPL ID invitation**. Today only the first two work.
- Owner side: on `ClassDashboardPage`, add "Invite by MathGPL ID" — owner pastes a participant's `MGP-XXXXXX`, server looks it up via existing `lookup_profile_by_student_id`, and writes a row to `class_invitations` targeted at that user.
- Participant side: `/join` shows an "Invitations for you" list pulled from `class_invitations` where the target matches the current user. Accepting it creates the pending request (or directly the membership, depending on owner policy — default: direct membership, since the owner already opted in by sending the invite).
- All gated by RLS already in place on `class_invitations`.

### 3. SmartBoard view-only for participants
`SmartBoardPage` currently treats the `?viewer=…` flag as informational. Participants arriving from `/student/class/:classId` must get a strictly read-only view:
- Detect participant mode (route param or `viewer=class:<id>` query) and short-circuit `PresentationView` to a read-only renderer: no toolbars, no edit handlers, no notebook mutation, no "generate" buttons.
- Teacher's active notebook is followed via realtime subscription to `class_smartboard_state` for that class (subscribe on participant side, swap the rendered notebook id when it changes).

### 4. Class Notes empty state
Already implemented ("Your teacher hasn't released any notes…"). Spec wording is "Class Notes not yet available." — minor copy tweak only.

### 5. "Previous Classes" semantics
Today `/join` lists every class the user is still a member of. That already matches the spec (auto-appears if not removed and class still exists). No code change; just confirm by test.

## Security test (must pass before shipping)
Run with two real accounts in preview:

1. Account A: create class `Alpha`, add a lesson note, release it to students, generate join code.
2. Account B: open `/join`, submit the code → "Waiting for approval".
3. Account A: open class dashboard → see B's request → Approve.
4. Account B: auto-redirects to `/student/class/<id>` with no manual reload.
5. From Account B, attempt and confirm all of these FAIL (UI absent + direct API call blocked by RLS):
   - Create / edit / delete any lesson note
   - Read Account A's private notebooks
   - List Account A's other classes
   - Mutate `class_members`, `class_invitations`, `class_join_codes`, `class_smartboard_state`
   - Hit `/teaching-hub/classes/<id>` (owner dashboard) for Alpha → bounced by `ensureClassOwner`
6. Account A removes Account B → Account B's `/student/class/<id>` bounces to `/join` and class disappears from Previous Classes.

If any step fails, stop and fix RLS before adding features.

## Technical notes
- No new tables; reuse `class_join_requests`, `class_invitations`, `class_members`, `class_smartboard_state`.
- One migration only if SmartBoard state needs realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.class_smartboard_state;` (check first — may already be added).
- All owner mutations stay behind `ensureClassOwner` + existing `is_class_owner()` RLS. No new privileges granted to participants.
- No code copied from the old Join Class implementation.

## Out of scope
- Renaming/redesigning Create Class screens.
- Any change to lesson-note generation or pedagogy pipeline.
- Email notifications for invites/approvals.
