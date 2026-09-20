# Resolve the persistent Adventure linking error

## Confirmed diagnosis

The Adventure picker is working and loads the teacher’s Adventures. The failure occurs only when an Adventure is selected.

The live backend currently has neither required relationship table:

- `class_adventures`: absent
- `adventure_bar_questions`: absent
- Permissions and access policies for those tables: absent

The current draft is still **open**, not accepted. Therefore its staged database structure has never been applied. The app sends the correct Class + Adventure save request, but the backend rejects it because there is nowhere to store the relationship.

## Resolution

1. Accept this draft so the staged database structure is applied to the live backend.
2. Confirm the two relationship tables, their permissions, access rules, foreign keys, and API visibility are live.
3. Replace temporary database type workarounds with regenerated types if required.
4. Test the real teacher workflow rather than hiding the failure:
   - link several Adventures to one Class;
   - refresh and confirm every card remains;
   - reuse one Adventure in a second Class;
   - assign a Question through Class → Adventure → Progress Bar;
   - confirm assignments remain isolated between Classes;
   - unlink and relink without deleting the Adventure, bar setup, or student work.

No Adventure editor, video, timeline, rewards, playback, Game Slate, or existing Adventure record will be redesigned.
