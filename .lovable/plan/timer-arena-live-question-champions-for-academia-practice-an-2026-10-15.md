# Timer Arena — live question champions for Academia Practice and Assignments

The picture is several separate screens, not one page. Each one goes in its own place. The existing timer, the board, the marking, lesson notes and the Academia structure stay as they are. Timer Arena is a new reporting layer that sits on top of them.

## What exists today (checked)
- Academia Sessions already have one "Session guest link" per session. It opens the session's questions with no sign-in, and the work is stored separately as guest work.
- The timer already starts on the first input, pauses and resumes, and saves each attempt with its success. It keeps a personal best and an overall best for each question.
- A Speed Performance page already exists for classes and for students.
- The problem: there is only one link per session, so every teacher using a session would share one leaderboard. That breaks the main rule.

## What gets built

### 1. Teacher session controls (Screen 1)
- On an Academia Session page, teachers see four buttons: **Lesson Notes, Smartboard, Share Session, Reports**. Students never see them.
- Teachers from a school's own staff keep their editing tools. Teachers browsing another public school's Academia can share and see their own reports, but they cannot edit anything.

### 2. Share Session: one group per share
- Each time a teacher shares, a new participation group is created with its own random link. Examples: "Monday Class A", "Tuesday Revision".
- Entry settings for each group: **Name** (off / optional / required) and **Profile picture** (off / optional / required). Anonymous IDs such as Learner-4827 are on when the name setting allows it. Every student can pick a built-in avatar instead of uploading a photo.
- Names are checked against a blocked-words list. Uploaded photos are kept private and are only shown inside that group's report.

### 3. Student joins through the link (Screen 2)
- A join card asks for a name and photo, following the teacher's settings, then opens the session's questions.
- The same device keeps the same student identity when they come back. Changing a name or photo never deletes earlier times.

### 4. Timed solving (Screen 3): unchanged
- The board and timer work exactly as they do now. When the existing marking confirms 100%, the result is sent to the Arena in the background, so the board never waits.
- Times that count are measured by the server, from the first-input signal to the confirmed completion. A time sent by the device alone is never trusted. Partial or failed attempts never enter the rankings.

### 5. Ranking rules
- Faster time ranks first. On an exact tie, whoever got there first stays ahead. Full precision is always used, never the rounded time shown on screen.
- Each student has one best time per question in each group. A slower repeat never replaces it.
- Every ranking only counts students in the same group. Teacher A's and Teacher B's groups never mix, even on the same session.

### 6. Student "Your Results" panel (Screen 4)
- Shows your best time, the group's overall best time and your position (for example "3rd of 28 ranked students"), shown separately from how many students joined.
- Also shows how far you are behind the next place and how much you need to improve to reach the Top 5.
- "You're the Question Champion!" when you are first. "Complete this question correctly to enter the ranking" before any correct finish.

### 7. Reports and the live classroom display (top of the picture)
- **Reports** lists the teacher's own groups for the session. Each one shows when it was made, how many joined, how many are online now and how many correct finishes there are. Buttons: Open Live Report, Copy Link, Entry Settings, Close group.
- **Live Report**: a header with the school, class, subject, topic, subtopic, session, question count, the LIVE status and the participant count.
- **Champions Wheel**: one equal slice per question (360 ÷ number of questions), showing each champion's avatar, name and time, with the trophy in the middle. A slice glows gold briefly when its record is broken. Empty slices show "No champion yet". Sessions with more than 8 questions are split into wheel pages ("Q1–8", "Q9–16").
- **Top 5 columns**, one per question, with gold, silver and bronze for the top three. Footer chips: "Fastest Correct Answers Only", "Each Question Shows Top 5 Students", "X of Y Participants Shown".
- **Full Screen / Classroom Display**: a separate view-only link with no settings and no private records. On phones it changes to a question picker with swipeable cards.
- Updates arrive live. Only the affected slice and column change. When the report reconnects, it reloads a fresh snapshot so nothing is missed. Built to handle groups of 1,000 or more.

### 8. Teacher Assignments
- The same Arena (wheel, Top 5, student position) can be switched on from an existing assignment's dashboard. Only students already allowed on that assignment can join it. Deadlines, marking and permissions stay unchanged, and each assignment's rankings stay separate.

### 9. Offline Academia app
- It stays as it is today: practice offline with results saved on the device. Arena rankings need a connection, so the offline app shows "Connect to see live rankings".

## Delivery order
1. Groups, joining and entry settings, with server-measured times and rankings.
2. Teacher session buttons, the Reports list, and the student Your Results panel.
3. Live Report with the Champions Wheel, Top 5 and classroom display.
4. Assignment support.

## Technical details
- New tables (each with grants and RLS): `arena_shares`, `arena_participants`, `arena_attempts`, `arena_bests`.
  - `arena_shares`: id, random code, display_code, owner_id, source_kind ('academia_session' | 'assignment'), source_id, academia_id/org_id, title, entry_config jsonb, status, created_at.
  - `arena_participants`: id, share_id, user_id null, device_token, display_name, anon_label, avatar_key/photo_path, joined_at, last_seen_at. Unique (share_id, device_token) and unique (share_id, anon_label).
  - `arena_attempts`: id, share_id, participant_id, question_id, started_at (server), completed_at (server), elapsed_ms, success, idempotency_key unique.
  - `arena_bests`: unique (share_id, participant_id, question_id), best_ms, achieved_at, attempt_id. Updated only when a new time is strictly faster.
- All writes go through server functions / `/api/public/arena/*` routes that check the share code plus the participant's device token. `start` stamps the server time. `complete` re-runs the existing pure grading (`studentGrading`) on the submitted lines, then stores the elapsed time based on the server clock. Owner-only RLS on shares and reports. Students only get read RPCs scoped to their own group (`arena_my_position`, `arena_top5`). The display link uses a separate `display_code` that returns read-only top-5 and champion data.
- Ordering: `best_ms ASC, achieved_at ASC, attempt_id ASC`.
- Realtime: broadcast on the `arena:<share_id>` channel after each change to a best time (reusing the Adventure live channel helper). Clients patch the affected question, and re-fetch the snapshot after a reconnect. Presence powers the "online" count.
- Photos go in a private `arena-avatars` bucket and are shown through signed URLs. Built-in avatar set provided.
- The existing single "Session guest link" keeps working. New shares use the new links (`/arena/<code>`).
- Tests: tie rule, strictly-faster personal best, group isolation, wheel slice maths, wheel pages, denominators shown correctly.
