# Restore Smartboard Content Synchronization

## Root cause (confirmed)

This is a regression from the **most recent security fix**, not a content-saving bug.

What I verified directly against the database and code:

- The teacher's board content **is** being written. `class_smartboard_state.state_json` contains live snapshots (e.g. 305 and 1649 bytes) — equations, free-write lines, boxes, etc. are persisting correctly.
- `class_smartboard_state` is in the realtime publication and has `REPLICA IDENTITY FULL`. Table RLS lets members read the row when smartboard access is enabled. So the data layer is healthy.
- The last security migration made every class channel **private** (`{ config: { private: true } }`) and added Row-Level Security on `realtime.messages` gated by `can_access_realtime_topic()`.

The problem: when a channel is `private: true`, Realtime runs an **authorization check at subscribe (join) time** against `realtime.messages` RLS. That policy calls `auth.uid()` on the realtime socket. The realtime socket is not reliably carrying the user's auth token before these channels subscribe (the `.channel(...).subscribe()` calls fire in `useEffect` on page load, before the session token is attached to the socket). With no `auth.uid()`, `can_access_realtime_topic()` returns `false`, the join is rejected, and **the entire subscription dies** — no postgres_changes events arrive.

This is exactly why only the topic/heading appears: the topic is loaded once via a direct DB query on mount (`loadBoardState`), so it shows up. Everything that depends on the **live** subscription (notes, equations, drawings, AI solutions, floating numbers, worked solutions, beat advancement) never updates because the realtime channel was never authorized.

Channels affected (all switched to private in the last fix):
`sb-sync-*`, `smartboard-state-*`, `class-visibility-*`, `class-notes-*`, `active-student-members-*`, `join-requests-*`, `member-of-*`.

## Fix

Authenticate the realtime socket before subscribing to any private channel, and keep it authenticated across token refreshes. This keeps the new security model (private channels + `realtime.messages` RLS) intact while restoring delivery.

1. **Add a small realtime-auth helper** that fetches the current session and calls `supabase.realtime.setAuth(token)`, so the socket presents the user's JWT. It will be awaited right before each private-channel `subscribe()`.

2. **Register a global auth listener** (in `App.tsx`) that re-runs `setAuth` on `onAuthStateChange` (sign-in, token refresh) so long-lived classroom sessions stay authorized.

3. **Update every private-channel subscription site** to await the helper before creating/subscribing the channel, using a cancel-safe async pattern so the `useEffect` cleanup still removes the channel correctly:
   - `src/hooks/useSmartboardSync.ts` (`sb-sync-*`) — the main board-content channel
   - `src/pages/student/StudentSmartBoardPage.tsx` (`smartboard-state-*`, `class-visibility-*`)
   - `src/pages/student/StudentClassPage.tsx` (`class-notes-*`)
   - `src/components/smartboard/ActiveStudentControl.tsx` (`active-student-members-*`)
   - `src/components/class/JoinRequestsPanel.tsx` (`join-requests-*`)
   - `src/components/class/JoinClassPanel.tsx` (`member-of-*`)

4. **Add subscribe-status handling** on the board channels: log/track `CHANNEL_ERROR` / `TIMED_OUT` from `.subscribe((status) => …)` and re-run `setAuth` + resubscribe once, so a transient unauthorized join self-heals instead of silently going dead.

No database/schema changes are needed — the RLS policies and `can_access_realtime_topic()` are correct; they just need an authenticated socket.

This only touches the realtime wiring. The Student Edit Permission feature already built on top of this layer will start working reliably once delivery is restored, with no changes to its logic.

## Verification

1. Open the teacher SmartBoard for a class and a student SmartBoard for the same class in a second session.
2. Teacher writes `x + 5 = 12` → confirm it appears on the student board with no refresh.
3. Teacher advances a beat / adds a worked solution / floating numbers → confirm each appears live on the student.
4. Teacher edits an existing line → confirm the edit mirrors live.
5. Confirm settings/admin controls (teacher-only chrome, AI settings, permissions) do **not** appear for students — sync scope stays content-only, matching current `data-sb-teacher-only` rules and the snapshot payload (which excludes admin/settings UI).
6. Check the browser console for channel `SUBSCRIBED` status (no `CHANNEL_ERROR`).

## Technical details

- `supabase.realtime.setAuth(accessToken)` attaches the JWT to the realtime socket; private-channel joins then pass `realtime.messages` RLS because `auth.uid()` resolves.
- The async subscribe pattern:
  ```text
  let ch = null; let cancelled = false;
  (async () => {
    await ensureRealtimeAuth();
    if (cancelled) return;
    ch = supabase.channel(topic, { config: { private: true } })
           .on('postgres_changes', {...}, handler)
           .subscribe((status) => { /* retry on CHANNEL_ERROR */ });
  })();
  return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  ```
- `src/integrations/supabase/client.ts` is auto-generated and will not be edited; the helper and listener live in separate files.
- The `notebook-scan-*` broadcast channel stays public/unchanged (intentional, secret-code paired).
