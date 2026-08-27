# Public access: Smart Cards and MathGPL Live

## What I verified in the current code

- The public routes already exist: `/c/:slug`, `/c/:slug/solve`, `/c/:slug/game`, plus `/card/:slug` and `/challenge/:slug` aliases, and `/live/join/:code`, `/live/s/:sessionId` are already outside the sign-in gate.
- **The old domain is hard-coded in two places**: the link builder uses `https://golden-hour-academy.lovable.app` as its public site, and the social-preview endpoint uses the same string as its default. That is why every copied/shared card link points at the old address.
- The teacher's Invite Link is built from `window.location.origin`, so a link copied inside the editor/preview carries a preview host instead of the live MathGPL domain.
- **Solving is currently gated**: pressing Start on a public Smart Card checks for a signed-in user and sends visitors to `/auth?next=…`. The solve page itself already supports a guest username, so the gate is the only thing blocking account-free solving.
- **Share Smart Card only works where the native share sheet exists.** It calls `navigator.share` and silently falls back to a clipboard copy — inside the app preview and on desktop browsers nothing appears to happen.
- Published Smart Cards and public Live sessions are already readable without an account. Lesson notes are **not** — there is no public read path, so audience "Notes" needs an explicit per-session visibility list.
- Sessions have no free-entry setting today, and the audience session page links its tiles into `/student/class/:id` — the normal student area, which is account-only.

## What will be done

1. One public domain constant (`https://mathgpl.com`) used by Copy, Share, the Invite Link, canonical/`og:url` and the preview endpoint. Old links keep resolving; new ones never carry the old host.
2. Account-free solving: Start opens the board or the Game stage directly, with the existing guest-username step. No sign-up, no login, no redirect.
3. A working Share sheet: native share where available, otherwise a dialog with WhatsApp, Facebook, X, Telegram, LinkedIn, Instagram (copy-for-caption) and Copy link — all pointing at `mathgpl.com/c/<code>`.
4. Isolation: the public card and public Live experiences render in their own shell with no route into workspace, dashboard, lesson notes, reports, gallery, courses or classes. One clear **Visit MathGPL** link to "Mathematics Reimagined".
5. Live: an **Allow free entry** switch at the top of the teacher's Audience section. On → the Invite Link enters immediately; off → the visitor sees "Waiting for teacher approval" and the teacher approves from the same section. Join Code and Invite Link both stay.
6. A restricted audience view with exactly **Audience · Notes · SmartBoard · Challenge · Game Challenge**, where Notes shows only the notes the teacher marked visible for that session, and no permanent student profile, ID, report or history is created.
