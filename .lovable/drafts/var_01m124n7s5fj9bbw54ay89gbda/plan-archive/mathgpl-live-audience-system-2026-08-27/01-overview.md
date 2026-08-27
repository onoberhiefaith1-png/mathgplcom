# MathGPL Live Audience System

A person who receives a MathGPL Live link joins that one session with no account, no sign-in and no Student ID — and sees only Notes, SmartBoard, Challenge and Game Challenge for that session. Everything else on the platform stays members-only.

Naming: the interface says **MathGPL** everywhere (no "MyGPL"), and audience-facing labels are **Notes**, **SmartBoard**, **Challenge** (Assignment), **Game Challenge** (Adventure).

## What already exists and is reused

- Live sessions with a Session Code, invite link (`/live/join/:code`) and a backing class row.
- Public audience routes `/live/join`, `/live/join/:code`, `/live/s/:sessionId` — already outside the sign-in gate.
- Guest identity token in the browser and the "ask participants for a name" switch.
- Lesson Notes, SmartBoard live sync, Assignments and Adventures engines.

## What is broken or missing today

- The session page's tiles send audience members into `/student/...` pages, which require an account — the audience hits the members-only area and gets bounced.
- All content tables (notes, board state, assessments, adventures) are readable only by signed-in members, so a link visitor sees nothing even on the public page.
- There is no Allow Free Entry switch, and the teacher's "Audience" tile opens the account-based class roster (Student IDs, workspace roster) rather than an audience list.
