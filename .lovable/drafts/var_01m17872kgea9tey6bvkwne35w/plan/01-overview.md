# MathGPL Notification System — professional build-out

A notification centre already exists: a bell with a live unread badge, an inbox with All / Unread / Questions / Announcements tabs, a thread page with a single response box, a role-based audience engine (administrator, school, teacher, parent can send; students only ask questions), and per-recipient read tracking. What is missing is the professional layer around it: a dropdown panel with sound, notification categories, sender-controlled responses, engagement reporting, per-role sending dashboards, class-level targeting, and automatic system notifications.

## What gets built

**1. Notification panel on the bell**
Clicking the bell beside the profile opens a compact panel (latest 8, unread first, "Mark all read", "Open notification centre") instead of jumping straight to a page. A short sound plays once when the unread count rises while the tab is open; a small speaker toggle stores the user's preference locally.

**2. Categories and filters**
Every notification carries a category: Announcement, Important, Class, Assignment, Course, System, Event, Reminder, Update. Categories show as coloured chips in the inbox and become filter chips alongside the existing tabs. Senders pick one when composing.

**3. Responses are opt-in, not a chat**
The composer gets an "Allow responses" switch. The thread page shows the response box only when the sender allowed it; otherwise a quiet "This notification does not accept responses" line. A recipient's state becomes Unread → Read → Responded.

**4. Two-step composer**
Step 1 Message: title, message, category, optional link/image/document attachment, allow-responses switch. Step 2 Audience: "Who do you want to notify?" with the presets each role may use, then narrowing (region → schools for the administrator, classes for school and teacher), then an add/remove list of individual people with a live recipient count ("All Teachers in London — 42 recipients, minus Teacher A, plus Teacher B").

**5. Sending dashboards per role**
A shared dashboard shell at `/notifications/sent`, with the sections each role is allowed:
- Administrator: overview totals (sent, delivered, read, unread, responded), New Notification, and full history across the platform.
- School: same shell, audience limited to its own teachers, students, classes and parents; no global or region controls.
- Teacher: Received / Sent / Unread / History, audience limited to all my students, a class, or selected students.
- Parent: Received / Sent / History, sending only to connected schools and teachers.
- Student: inbox only, plus the existing Ask a Question.

**6. Class-level targeting**
`classes` becomes a first-class audience for schools and teachers: pick one or several classes, recipients resolve from the class roster.

**7. Automatic system notifications**
A single server helper is called from existing flows so the platform speaks for itself: new assignment, assignment date changed, new course access, teacher answered a question, class schedule changed. Each carries its category, its context (class, course, assignment) and a target path so "View in context" lands on the right screen.

**8. Engagement**
Each sent notification records recipient count, read count and responded count, shown in the history table and on the notification's own detail view. Teachers see only their own; the administrator sees everything.
