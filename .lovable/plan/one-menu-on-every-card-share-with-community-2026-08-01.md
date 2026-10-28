# One "⋯" menu on every card: Share with Community

Every item a teacher owns — lesson notes, classes, adventures, live sessions, backgrounds,
buildings, rewards, progress bars, effects and individual assets — gets the same three-dot
menu in its top-right corner. The first item in that menu is always **Share with Community**.

## The menu

```text
⋯
 ├─ Share with Community        (opens the existing publish sheet)
 ├─ Update listing / Unpublish  (only when already shared)
 ├─ Copy / Duplicate           (only where that already exists)
 └─ Delete                      (moved in from the hover trash icon)
```

- Already-shared items show a small **Shared** badge on the card, so the owner can tell at a glance.
- Students never see the menu's Share entry (they don't publish teaching resources).

## Where it appears

| Surface | Card | Shares as |
|---|---|---|
| Lesson Notes shelf | notebook card | Lesson Note |
| Lesson Notes assets / Asset Library | each asset | Lesson Note Asset |
| Teaching Hub → Classes | class card | Class |
| Adventure → Games | game card | Adventure |
| MathGPL Live → Sessions | session card | Live Session |
| Homepage → Background gallery | background | Background |
| Homepage → Replace Building | building | Building |
| Add asset to your game → Background / Reward / Progress Bar / Effect tabs | each tile | Background / Reward / Asset / Special Effect |

## Classes behave differently

A class is never copied. Sharing a class publishes it as a **public class**: it flips the class
to community-shared and community members see **Request Access / Join Class** instead of a copy
action. Once a member is inside the class, every lesson note, asset and adventure attached to
that class comes with the membership — nothing is duplicated. Making the class private again
also unpublishes the listing.

## Technical notes

- New `src/components/community/ShareMenu.tsx`: a `DropdownMenu` trigger (`MoreVertical`) that
  takes `kind`, `sourceId`, `title`, optional `description`/`hashtags`/`payload`, plus optional
  `extraItems` and `onDelete`. It owns a `PublishDialog` instance and calls `findMyPublication`
  to decide between Publish / Update listing / Unpublish and to render the Shared badge.
  Gated by `useCommunityRights().canPublish`, and hidden entirely when
  `useCommunityMode().isCommunity` (the mirror stays read-only).
- Reuses the existing engine unchanged: `publishResource`, `setResourceStatus`,
  `findMyPublication` in `src/lib/community/community.ts`, and the `CommunityKind` union in
  `src/lib/community/types.ts` (already includes `lesson_asset`, `decoration`, `effect`,
  `reward`, `session`). No migration needed.
- `AssetsPanel.tsx`: the hover trash button on each tile is replaced by `ShareMenu` with
  `onDelete={() => remove(a)}`; game asset kind maps to community kind as
  `background→background`, `reward→reward`, `progress_bar→asset`, `effect→effect`, and the
  payload carries `storage_path`/`media_type` so a copy lands in the recipient's asset library.
- Class cards use `ShareMenu` with `kind="class"` and an `onPublished` hook that sets
  `classes.community_shared = true`, matching what `ClassCommunityShare.tsx` already does; that
  panel stays as the in-class control.
- Sessions publish with a payload holding the join code and platform link so
  `/community/live` → Join Session keeps working.
- Card layouts get a `relative` wrapper and an absolutely positioned trigger so nothing shifts;
  each surface keeps its own light/dark card styling.
