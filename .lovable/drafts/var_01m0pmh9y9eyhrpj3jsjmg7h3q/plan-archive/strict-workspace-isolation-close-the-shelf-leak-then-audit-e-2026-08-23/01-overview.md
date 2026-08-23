# Strict workspace isolation — close the shelf leak, then audit every shelf

## What I found (verified against your live data)

The leak is real, and it is an authorization-scope bug in the *queries*, not missing database security.

- Lesson notes already have owner-only write and delete, owner read, plus three deliberate extra read paths: notes published to Community, notes shared to class members, and notes a school owner reviews inside its own organisation.
- The Lesson Notes shelf and the Smartboard shelf filter by workspace, archive state and storage scope — but **never by the signed-in owner**. They lean entirely on the database rules, so every row those three extra paths allow lands on your shelf as if you had made it.
- Confirmed with live data: two lesson notes ("Statistics", "diffentiation") owned by one account are published to Community, live in the personal workspace, and are not archived — so they satisfy the shelf query for **every** other signed-in teacher. That is exactly the symptom you saw.
- The same pattern exists for Adventures: the adventures list filters by workspace only, and adventures carry equivalent community / class / school read paths.
- File storage is already private: every bucket (avatars, course media, floating knowledge, game assets, reference images, slide media, smart-card previews) is non-public, so files are reached only through signed links.

So private data is not wide open — but "published to Community" and "shared to a class" currently also mean "appears on other teachers' private shelves". Publication must never create private-shelf presence.
