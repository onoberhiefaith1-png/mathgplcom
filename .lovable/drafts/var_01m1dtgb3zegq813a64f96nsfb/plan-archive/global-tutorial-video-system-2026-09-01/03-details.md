## Icon placement rules

- One shared control, rendered by the global tutorial layer — no per-page code, so pages added later get it automatically.
- Default position: top-right, floating just inside the page edge, small and low-contrast so it reads as chrome rather than an action button.
- Pages with a busy top-right (Academy building, board headers, dashboards with action rows) host the same control inline in their own header row via the existing hook, so it sits beside the existing buttons instead of over them. This is opt-in per page and only adds the control — no layout is rearranged.
- On narrow screens the control shrinks to icon-only and keeps clear of fixed headers; it never uses a hard-coded offset that can land on top of another button.
- Empty state: when a page has no tutorial yet, viewers see the icon in a quiet, non-clickable state (tooltip "No tutorial yet"), managers see it active so they can attach one. No "View Only" text anywhere.

## Who can manage

| | Watch | Add | Replace | Reorder | Remove |
|---|---|---|---|---|---|
| Administrator (platform admin) | yes | yes | yes | yes | yes |
| Asset Manager | yes | yes | yes | yes | yes |
| Everyone else, signed out visitors | yes | no | no | no | no |

Enforced by database policies on the tutorial records and the video bucket, so the rules hold even if the UI is bypassed.

## Technical notes

- **Data.** A new additive table for tutorial videos keyed by page route with an ordering position, title, storage path, status and timestamps; the existing single-video `page_guides` row for a page is treated as its first tutorial so nothing already uploaded is lost. New row-level policies allow write access to platform admins *or* rows in the existing `asset_managers` list, and matching storage-object policies for the `page-guides` bucket. Staged as a migration and applied when this draft is accepted — until then the new multi-video table does not exist in this preview.
- **Route key.** Keeps the existing `toPageKey` collapsing of dynamic segments, so `/class/<id>/notes` for every class shares one tutorial set.
- **Persistence.** The player element moves out of the route-dependent state: the provider keeps a tutorial session (which page's playlist, which video, open/closed, view mode) that survives route changes, and the `<video>` element is mounted once at app level. Navigating changes which page's tutorial the *icon* offers, never what is currently playing.
- **Player.** One reusable player component with custom controls: play/pause, draggable timeline, elapsed/total time, skip back 10s, skip forward 10s, speed menu 1x / 2x / 3x, volume slider, mute, fullscreen. No autoplay, no auto-advance to a next video; when a page has several tutorials a small list lets the user pick one.
- **Split view.** Reuses the existing split frame behaviour already used by the guide layer: both panels stay mounted in all three positions, so switching never remounts the page or restarts the video.
- **Management UI.** The existing manager dialog becomes a small per-page list: upload, retitle, reorder, replace and remove each tutorial, plus publish/unpublish.
- **Login and public pages.** The icon appears there too and simply plays whatever is published; management controls never render for signed-out visitors, and the auth flow itself is untouched.

## Verification

- Tutorial appears on the intro page, login page, rotating building, Teaching Hub, Lesson Notes, Smartboard, Classes, Adventure, Skill Builder and My GPL Life without overlapping existing controls, at desktop and mobile widths.
- Start a tutorial, navigate across three pages, confirm playback position keeps advancing and the page stays clickable in split view.
- Confirm a non-manager account sees no add/replace/remove controls and that a direct write attempt is refused.
