## What's wrong

Verified in the database: the active-instance uniqueness index on `learning_assignments` is

```text
(class_id, notebook_id, COALESCE(game_id, <zero-uuid>))  WHERE status = 'active'
```

`mode` ("assignment" vs "adventure") is not part of it. So once a Lesson Note is active in a class as an Adventure, assigning the same note to the same class as an Assignment collides and raises the duplicate error — exactly the case in the screenshot.

The application-level checks (`findActiveAssignment` / `checkDuplicate` in `src/lib/assignments/instances.ts`) already filter by mode when the caller passes it, so the database index is the blocking layer.

## Fix

1. **Additive migration** — drop `learning_assignments_active_triple_idx` and recreate it including the workspace type:

   ```text
   UNIQUE (class_id, notebook_id, mode, COALESCE(game_id, <zero-uuid>))  WHERE status = 'active'
   ```

   Identity becomes (Lesson Note + Class + Workspace Type + Adventure). No table or column changes, no data changes.

2. **`src/lib/assignments/instances.ts`** — make `mode` a required argument of `findActiveAssignment` so a duplicate lookup can never silently match across workspaces. The "adopt a game-less instance when an Adventure is chosen" path stays, but only within the same mode.

3. **Duplicate warning copy** — where the teacher-facing duplicate message is shown, make it name the workspace ("already assigned to this class as an Adventure") so the two workspaces read as distinct.

## Result

- Lesson Note A → KG1 → Adventure and Lesson Note A → KG1 → Assignment can both exist at once.
- Assigning the same note to the same class twice within one workspace still warns and reuses the existing instance.
- Archived instances remain untouched; re-assigning after archiving still creates a fresh instance.
