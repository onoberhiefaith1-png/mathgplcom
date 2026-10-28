## Technical detail

### 1. The structure change (already written, applies on accept)

`20260920080000_adventure_reusable_shell.sql`, staged in this draft and mirrored into the deployable migrations folder:

- `class_adventures` — `id`, `class_id` → `classes`, `game_id` → `games`, `linked_by` → `auth.users` (set null), `created_at`, `unlinked_at`, `unique (class_id, game_id)`. This is the single authoritative Class ↔ Adventure relationship; no duplicate or parallel table is created.
- `adventure_bar_questions` — `class_id`, `game_id`, `progress_element_id`, `notebook_id`, `section_id`, `question_key`, plus a foreign key on `(class_id, game_id)` back to `class_adventures`, so a question can only be placed on a bar of an adventure the class actually has. Unique per class + adventure + bar + question.
- `class_game_boards.pass_pct` — per-bar pass percentage, checked 0–100.
- GRANTs for `authenticated` and `service_role`; RLS enabled. Class owners manage; class members read only through an active link.
- Existing progress bars are reused — no new progress-bar table. The 17 existing Adventure boards are backfilled into the new link and placement tables so nothing already set up is lost.
- Both tables are added to Realtime and the API schema cache is refreshed, so the Class Adventures screen updates immediately after linking.

### 2. After the draft is accepted

- Confirm both tables and the `pass_pct` column exist live, and that the backfilled rows landed.
- Regenerate the database types so the Adventure code drops its temporary type casts.
- Run the type check and the Adventure/assignment tests.

### 3. End-to-end verification (signed in, against the live app)

- Link Runtown to Class A → card appears, no error. Link The Becoming and Algebra Quest → three independent cards, none replacing another. Refresh → all three persist.
- Re-linking the same adventure does not create a duplicate.
- From a question: Assign to Adventure → Class A → linked adventures listed → Runtown → only Runtown's bars → Progress Bar B → saved as Class A / Runtown / Progress Bar B.
- Send questions from two different lesson notes to different bars of different adventures.
- Link Runtown to Class B and confirm Class A's question does not appear there.
- Unlink from Class A and confirm the adventure itself, and Class B's use of it, are unaffected.

### Not touched

The Adventure editor, video, background, timeline, narration, timers, rewards, effects, preview, student playback, and the separate Game workflow.
