## Teacher side — MathGPL Live → Audience

The session dashboard's **Audience** tile stops opening the account-based class roster and opens a new session-scoped Audience page:

- **Join Code** and **Invite Link** — kept exactly as they are today (same code, same `/live/join/:code` link), moved up onto this page with copy buttons.
- **Allow Free Entry** toggle at the top.
  - ON: anyone with the link or code enters instantly — no login, signup, Student ID, approval or waiting screen.
  - OFF: an arriving person sees "Waiting for teacher approval" and appears on this page for the teacher to Approve or Remove.
- **Audience list** — everyone currently in the session with their name (or auto label such as "Guest 4F2A"), joined time, and live/waiting state, refreshing in real time. Approve / Remove controls appear when Free Entry is off.
- The existing "ask participants for a name" switch sits beside Allow Free Entry.

The account-based roster (Student IDs, workspace roster, class invitations) stays available for the Teaching Hub class pages; it is simply no longer what "Audience" means in Live.

## Audience side

`/live/s/:sessionId` becomes the real audience environment rather than a page of links into student pages:

- Session header: title, status, countdown before the start time, joined-as name, and the teacher's broadcast links.
- Four tiles only — **Notes**, **SmartBoard**, **Challenge**, **Game Challenge** — each opening a session-scoped audience route under `/live/s/:sessionId/...`.
- **Notes**: the session's lesson notes, read-only, and only those the teacher has shared with the session. Nothing private is exposed; if nothing is shared the page says so.
- **SmartBoard**: the teacher's live board, view-only, using the existing real-time board sync so it updates as the teacher writes during a TikTok/YouTube/Zoom broadcast.
- **Challenge**: the assignments the teacher published to the session, openable and solvable through the existing assignment engine, with progress kept against the guest participant for the session only.
- **Game Challenge**: the adventures published to the session, played through the existing adventure engine.
- Reports, Gallery, Games, Courses, account/profile, teacher tools and every other workspace area are absent — not just hidden links; the audience routes do not render or fetch them.
- Bottom of every audience page: **Visit MathGPL** → the existing landing page ("Mathematics Reimagined"), the single conversion point to signing up.

Before the scheduled start the SmartBoard tile shows the existing "Waiting for teacher" countdown instead of the board.
