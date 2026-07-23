# Fix: Students can't see assigned Adventures

## Root cause (verified against live data)

Data for the class `55079b0c…`:
- `class_game_boards`: 1 row linking notebook → game `019d94d8…` (ADDIV) ✅
- `class_adventure_notes`: 1 active row ✅
- `assessments` (kind=adventure): 1 row ✅
- `class_members`: 2

So the teacher's assign flow already wrote the correct rows. The student's Adventures tile calls `listClassGames`, which selects from `class_game_boards` and embeds `games:game_id(id, title, thumbnail_path)`. The `class_game_boards` read succeeds under member RLS, but the embedded `games` join returns `null` for every row because:

1. `public.games` has only one SELECT policy: `auth.uid() = owner_id` — students are not the owner.
2. `information_schema.role_table_grants` shows **no grants** on `public.games` to `authenticated` (the PostgREST role students use).

Result: PostgREST silently drops the embedded game → `listClassGames` returns `[]` → tile shows "No adventures yet." Assignments tile correctly shows nothing because the teacher only assigned as Adventure (kind=`adventure` is filtered out on the assignments tile by design, matching gameful).

## Change (single additive migration)

Open read access to `games` for class members whose class is linked to the game, plus the missing grant. No table shape changes, no data mutation, no other policies touched.

```sql
GRANT SELECT ON public.games TO authenticated;

CREATE POLICY "Class members can read linked games"
  ON public.games
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_game_boards b
      WHERE b.game_id = games.id
        AND (public.is_class_member(b.class_id) OR public.is_class_owner(b.class_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.class_games cg
      WHERE cg.game_id = games.id
        AND (public.is_class_member(cg.class_id) OR public.is_class_owner(cg.class_id))
    )
  );
```

The existing `Owners manage their games` policy (FOR ALL) stays untouched so teachers keep full control of their own games.

## Verification

1. Reload the student's `/student/class/<classId>` — Adventures tile should now list "ADDIV" with count 1 (already-open realtime channel on `class_games` + refetch on focus).
2. Tap the tile → `/student/class/<classId>/games/<gameId>/play` opens the ported gameful `GamePlayPage` with the progress bar wired to `class_game_boards`.
3. Student solves a question on the SmartBoard-style assessment board → `assessment_progress.score` updates → `useAdventureSync` mirrors it and the bar rises on both teacher `AdventureDashboardPage` and student `GamePlayPage` (already ported from gameful).

## Out of scope

- No changes to `AssignDialog`, `LinkAdventureDialog`, or any ported page — the gameful workflow (Lesson Note → Assign as Adventure → LinkAdventureDialog wires it to a game board → student plays → bars rise) is already in place; only the games-table read gate was blocking it.
- Existing "Owner manages their games" policy, other tables, and grants remain unchanged.
