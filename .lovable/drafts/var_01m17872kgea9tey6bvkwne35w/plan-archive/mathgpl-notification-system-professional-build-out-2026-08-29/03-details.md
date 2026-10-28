## Technical detail

**Database (staged as an additive migration; applies when this draft is accepted)**
- `notifications`: add `category text not null default 'announcement'` (checked against the nine categories), `allow_responses boolean not null default true`, `attachment jsonb` (`{ kind: 'image' | 'document' | 'link', url, name }`), `audience jsonb` (the resolved request, for history), `recipient_count integer not null default 0`.
- `notification_recipients`: add `responded_at timestamptz`.
- New security-definer function `notification_engagement(_notification_id uuid)` returning recipients / read / responded, callable only by the sender or an administrator; used by the history and detail views.
- Existing RLS stays as it is: read own sent + own received, update only my own read state. Sending and fan-out continue to run through the server engine on the service role.

**Engine (`src/lib/notifications/`)**
- `audience.ts`: add `"classes"` to `AudienceKind`, `classIds` to `AudienceRequest`, a `NOTIFICATION_CATEGORY` list with labels, and `canAllowResponses`. `SENDER_AUDIENCES` gains `classes` for `school` and `teacher`.
- `notifications.server.ts`: `reachableAudience` resolves `classes` from `class_members` (schools restricted to classes in their own orgs, teachers to classes they own); records `recipient_count` and `audience` on insert.
- `notifications.functions.ts`: `sendNotification` accepts category, attachment and `allowResponses`; `respondToNotification` rejects when the root has `allow_responses = false` and stamps `responded_at`; new `listSentNotifications` (history + engagement, scoped by role) and `notificationStats` (overview totals).
- New `system.server.ts` with `notifySystemEvent(...)`, called from the existing assignment, course, class and student-question flows.

**UI**
- `NotificationBell.tsx`: popover panel, sound on unread increase (single short WebAudio tone, no asset), `localStorage` sound preference.
- `ComposeNotification.tsx` becomes a two-step wizard; `AudiencePicker.tsx` gains class selection, region → schools narrowing and the add/remove recipient list with a live count.
- New `src/pages/notifications/SentNotificationsPage.tsx` at `/notifications/sent` — one shell rendering only the sections the signed-in role may use, with overview cards, "+ New Notification" and the history table.
- `NotificationsPage.tsx` gains category filter chips; `NotificationThreadPage.tsx` hides the response box when responses are off and shows engagement to the sender.

**Guardrails**
- Permission is re-derived on the server for every send; the composer's options are convenience only.
- A school can never resolve a recipient outside the organizations it owns; a teacher can never resolve outside their own classes and connected students.
- Recipients are never exposed to each other — the inbox only ever reads the signed-in person's own recipient rows.
- Students keep no broadcast path at all; Ask a Question stays a separate action.
