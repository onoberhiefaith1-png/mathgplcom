## Smart Card work

- **Domain**: replace the hard-coded public site with `https://mathgpl.com` in `src/lib/smartcards/smartCards.ts` and in the preview endpoint default, and treat the current published/custom domain as the live origin. `/c/:slug` stays canonical; `/card/:slug` and `/challenge/:slug` remain aliases.
- **No sign-in gate**: in `src/pages/public/SmartCardPage.tsx`, `open()` navigates straight to `/c/:slug/solve` or `/c/:slug/game`. The existing guest-username step on the solve page is the only identity step.
- **Share**: replace the silent `navigator.share` fallback with a share dialog — WhatsApp, Facebook, X, Telegram, LinkedIn, Instagram (copy caption), Copy link — each built from the canonical card URL. Copy Smart Card behaviour is untouched apart from the domain.
- **Social preview**: title, question-derived description, snapshot image and canonical URL already come from the preview endpoint; only the origin changes so previews resolve on the current domain.
- **Isolation**: the public card pages render without app chrome (no workspace/dashboard/notes links). The single outward link is **Visit MathGPL** → `/` ("Mathematics Reimagined"). The "Explore MathGPL Life" link on the not-found card becomes **Visit MathGPL** too.

## MathGPL Live work

- **Allow free entry** switch at the top of the Audience section of the teacher's session dashboard, beside the existing Join Code and Invite Link (both kept, Invite Link now built from the public domain).
- **Entry**: `/live/join/:code` and `/live/s/:id` stay public. With free entry on, the audience member enters immediately. With it off, they see "Waiting for teacher approval" and are admitted the moment the teacher approves in the Audience list — the existing guest token identifies them, so no account is created.
- **Audience shell**: the audience session page's tiles change from the student-area links to exactly Notes · SmartBoard · Challenge · Game Challenge, all scoped to the session and rendered inside the public shell. Gallery, Report and any student-dashboard route are removed for audience members.
- **Notes**: a per-session visibility list; the audience reads only notes the teacher marked visible for that session, through a read path that returns nothing for anything else.
- **Challenge / Game Challenge** reuse the existing Assignment and Adventure engines with Live wording, played with the guest identity — no student ID, report, gallery, school or class membership is created.
- **Visit MathGPL** at the bottom of the audience experience.

## Technical notes

- Additive schema staged for this draft: `sessions.allow_free_entry` (default true), a guest entry-request table for the approval queue, and a session note-visibility table — each with grants and policies that let anonymous visitors read only what a public session exposes. These apply when you accept the draft, so the Live approval and Notes visibility parts can only be exercised after that; the Smart Card domain, solving and Share fixes work immediately.
- Files touched: `src/lib/smartcards/smartCards.ts`, `src/pages/public/SmartCardPage.tsx`, `src/pages/public/SmartCardChallengePage.tsx`, `src/pages/public/SmartCardGamePage.tsx`, `supabase/functions/smart-card-preview/index.ts`, `src/pages/live/SessionDashboardPage.tsx`, `src/pages/live/ParticipantSessionPage.tsx`, `src/components/live/JoinSessionPanel.tsx`, `src/lib/live/sessions.ts`, plus a new public shell component and a share-sheet component.
- Nothing in the Smart Card editor, solving engine, question rendering, teacher workspace, SmartBoard, Assignment or Adventure engines is rebuilt.
