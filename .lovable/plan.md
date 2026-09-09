# Video buttons everywhere, saved position, links, and the workspace bar

## What you will get

1. The two round buttons (watch a video, and the settings/upload button next to it) appear on every page of **all five of your accounts** — administrator, school, teacher, parent, student.
2. Only you can upload. Anyone else signed into a teacher, school, parent or student account sees the watch button only, never the upload one.
3. You can drag the pair to any spot on the screen. Where you drop it is where everyone sees it, on every account.
4. Besides uploading a video, you can paste a **link**. Students click it and it opens the site straight away so they can watch there.
5. The yellow bar with "Exit workspace" comes back reliably at the top whenever you are inside another account, so you are never stuck in there.

## How each part works

### Who may upload

Your five accounts are separate logins, so upload rights are granted per account through the existing Asset Managers list — the same list that already controls the shared asset library. Your school, teacher, parent and student accounts are added to it, so each of them shows both icons, while ordinary teachers, schools, parents and students show only the watch icon. The database rules remain the gatekeeper — hiding a button is never the only protection. You can add or remove accounts from that list yourself in the administrator console.


### Buttons on every page

The tutorial layer already wraps every page, so nothing new is mounted. The change is that the watch button shows on every page even when a page has no video yet (disabled, as today), and the manage button follows the Asset Manager answer rather than platform-admin only.

### Saved position for everyone

A single stored position (x and y, kept as a percentage of the screen so it lands correctly on a phone as well as a laptop) is saved once by a manager and read by every visitor. Dragging is available only to accounts with upload rights; everyone else just sees the buttons where you left them. Position is stored per page, so a page whose corner is busy can have its own spot, and pages with no saved spot fall back to the default one you set.

### Links as well as videos

Each tutorial entry may hold either an uploaded video **or** a web address. Entries with a link render as a clickable item in the player list that opens the link. Uploading and linking use the same title, order, and publish controls that exist now.

### The workspace bar

The bar is driven by a note stored in the browser, and the recent privacy/sign-out cleanup can clear that note while you are still inside the visited account, leaving no way out. The note moves to a place the cleanup does not wipe mid-session, and the bar re-checks after sign-in, so it reappears on the visited account instead of vanishing. Its "Exit workspace" behaviour is unchanged: it returns you to your admin account.

## Technical notes

- `src/components/guides/PageGuideProvider.tsx` — manage rights from the Asset Manager check; expose the saved position and whether dragging is allowed.
- `src/components/guides/PageGuideLauncher.tsx` — position from the stored value; pointer drag for managers only, persisting on release.
- New table `page_guide_placement` (page_key unique, x_pct, y_pct, timestamps) with GRANTs, RLS: read for `anon` + `authenticated`, write only where `public.can_manage_tutorials()` is true.
- `page_guide_videos` gains a nullable `link_url`; `video_path` becomes nullable with a check that exactly one of the two is present. `src/lib/guides/tutorials.ts` maps and validates it; `TutorialPlayer` renders link entries as an open-link action.
- `src/components/guides/PageGuideManagerDialog.tsx` — add a "Paste a link" input beside the file picker.
- `src/lib/accounts/impersonation.ts` and `src/lib/auth/sessionReset.ts` — keep the active-workspace note through the identity-change cleanup; `ImpersonationBanner.tsx` re-reads it on auth-state change.
- Focused tests: placement percentage clamping, link/video validation, and that the workspace note survives the sign-in cleanup.
