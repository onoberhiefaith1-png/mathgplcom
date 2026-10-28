# Notification & Communication Engine

One engine powers every message on the platform: broadcasts, system alerts, student questions and replies. It is contextual and purposeful — no chat lists, no presence, no open user-to-user messaging.

Two shapes only:

```text
Notification  ->  Response  ->  Response   (thread stays attached)
Student Question -> Teacher Response -> Student Response
```

## Who can do what

| Role | Send notification | Receive | Respond | Ask a Question |
| --- | --- | --- | --- | --- |
| Administrator | Anyone on the platform | Yes | Yes | — |
| School | Its teachers, students, parents | Yes | Yes | — |
| Teacher | Its classes / connected students | Yes | Yes | — |
| Parent | Connected school / teachers only | Yes | Yes | — |
| Student | No | Yes | Yes | Yes |

Permission is decided on the server from the existing role + connection/class structure, not by hiding buttons. A student calling the send action directly is rejected.

## What gets built

- **Notifications bell** in the top bar next to the account area, with a live unread badge, reachable from the rotating building and every workspace.
- **Notification Centre** (`/notifications`) with tabs All | Unread | Questions | Announcements, unread styling, Mark all as read, and no deletion on read.
- **Thread view** — original notification plus responses, lightweight, with a single Respond box and a View/Open action that jumps to the original context (class, assignment, adventure, course, lesson, smartboard).
- **Compose** — audience picker sized to the sender: administrator picks Everyone / all or selected schools, teachers, students, parents / region / individuals, with add-and-remove on top of a filtered audience and a live recipient count. School and teacher composers reuse the same picker limited to their own people.
- **Ask a Question** button inside the student's active Smartboard workspace: a small panel, the question text, automatic context capture (student, class, course, assignment/adventure, lesson, board item, time), submit without leaving the activity. It routes to the teacher who owns that activity.
- **System notifications** raised from existing flows already in the app: assignment received/submitted/deadline, connection request/accepted, course activity, school and platform announcements.
