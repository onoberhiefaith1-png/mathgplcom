## Diagnosis

The student's game screen renders only the progress-bar frame (bundled asset from `src/assets/adventure/card-frames/…`) — the **background image and rewards are blank**. The prefetch fetches game data and signs URLs, but for students every `storage.createSignedUrl(...)` call on the `game-assets` bucket returns `null` because the current storage RLS is teacher-only:

```
SELECT: bucket_id='game-assets' AND foldername[1] = auth.uid()::text  -- teacher only
```

Students never own the folder, so signing fails → `SignedMedia` renders the empty placeholder → background + rewards stay blank while the progress-bar (which uses bundled frames, not storage) still shows. This is why the port from Gameful looked partial: same code path, but storage policies weren't opened to class members.

Prefetch also silently drops missing URLs, so `waitForSceneReady` resolves fine and the page reveals — but there's nothing to reveal.

## Fix (backend RLS only, additive)

Add a second SELECT policy on `storage.objects` for the `game-assets` bucket that grants access to **any authenticated user who shares a class with the folder-owner teacher, when that teacher owns a game the class is using**. This keeps the existing teacher-only policy intact and simply widens read access to enrolled students.

Migration (additive):

```sql
create policy "Class members read teacher game files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'game-assets'
  and exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = auth.uid()
      and c.owner_id::text = (storage.foldername(name))[1]
      and (
        exists (
          select 1 from public.class_game_boards cgb
          join public.games g on g.id = cgb.game_id
          where cgb.class_id = cm.class_id and g.owner_id::text = (storage.foldername(name))[1]
        )
        or exists (
          select 1 from public.class_games cg
          join public.games g on g.id = cg.game_id
          where cg.class_id = cm.class_id and g.owner_id::text = (storage.foldername(name))[1]
        )
      )
  )
);
```

(If `games` uses a different owner column, or `class_games`/`class_game_boards` differ, the migration is adjusted to the real columns before running — no schema changes, policy only.)

## Frontend robustness (small, targeted)

1. In `src/lib/games/prefetch.ts`, log a single `console.warn` when `getSignedUrls` returns fewer URLs than requested paths, so a future storage-permission regression is visible in the console instead of a silent blank canvas.
2. No UI/layout changes. Atomic fade-in stays as it is.

## Verification

- Sign in as a student and open `/student/class/:classId/games/:gameId/play`.
- Confirm background image + reward assets paint together with the progress bar (single fade-in, no pop-in).
- Network: `object/sign/game-assets/...` requests return 200 for the student.
- Teacher-side smartboard/game editor still works unchanged (existing owner policy untouched).