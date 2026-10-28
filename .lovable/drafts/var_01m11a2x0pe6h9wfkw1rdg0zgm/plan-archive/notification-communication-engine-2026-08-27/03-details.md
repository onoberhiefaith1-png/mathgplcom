## Decisions taken (say if you want them different)

- A student question goes to the teacher who owns the assignment/adventure/course activity; if none can be resolved, to the teacher(s) of the student's class.
- Parents may send to connected schools and connected teachers only — never to other parents or students other than their own children.
- Regions come from the existing country/region field on profiles; a region filter is only offered to the administrator.

## Technical section

Data (staged as an additive migration, applied when this draft is accepted):

- `notifications` — id, kind (`broadcast` | `system` | `student_question` | `response`), sender_user_id, sender_role, subject, body, context jsonb (org/class/course/lesson/assignment/adventure/board ids + labels), target_path, thread_root_id, parent_id, created_at.
- `notification_recipients` — notification_id, recipient_user_id, read_at, responded_at, unique per pair; indexed on (recipient_user_id, read_at).
- Both tables get GRANTs plus RLS: a user reads notifications they sent or received; inserts go only through server functions (service role), so a client cannot forge a sender or audience.
- `unread_notification_count()` security-definer helper for the badge.

Server functions in `src/lib/notifications/*.functions.ts`, all with `requireSupabaseAuth`:

- `sendNotification` — resolves the caller's role via `ensure_account`/`user_roles`, expands the requested audience through the existing `connections`, `class_members`, `account_memberships` and `organizations` structure, intersects it with what that role may reach, then fans out recipients. Students are rejected outright.
- `askQuestion` — student-only; captures context, resolves the owning teacher, creates a `student_question` notification.
- `respondToNotification` — allowed for any recipient of the thread, including students; creates a `response` child addressed to the original sender.
- `listNotifications`, `markRead`, `markAllRead`, `resolveAudience` (counts + preview for the composer).

Frontend:

- `src/lib/notifications/useNotifications.ts` — React Query hooks plus one Supabase realtime subscription on the recipient row for live badge updates.
- `NotificationBell.tsx` rendered in `AcademyTopBar` beside `AccountMenu`, so it appears on the rotating building and every workspace shell.
- `src/routes/notifications/index.tsx` (centre + tabs) and `src/routes/notifications/$id.tsx` (thread + Respond), each with `head()` metadata, `errorComponent` and `notFoundComponent`.
- `ComposeNotification.tsx` with `AudiencePicker.tsx` (audience preset, filters, selected list, add/remove chips, live count), gated by an entitlement-style capability check plus the server rule.
- `AskQuestionButton.tsx` mounted inside the student Smartboard workspace only (student role + active activity), opening a small panel — the student never leaves the board.
- Existing flows (assignment create/submit, connection request/accept, course assignment) call `sendSystemNotification` at their existing server entry points; no page redesign.

Tests: audience expansion per role, student send rejected, student question routing and context capture, respond-returns-to-sender, unread count and mark-all-read, thread integrity.
