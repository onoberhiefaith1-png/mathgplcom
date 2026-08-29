# Universal Page Guide Video

Every page keeps working exactly as it does today. A small **Page Guide** control appears on the page, and clicking it opens the guide video beside the page — never on top of it. The page stays fully interactive while the video plays, so the user can follow along and click as they watch.

## What the user experiences

- A small `▶ Guide` pill on the page. It only appears when an administrator has published a guide for that page; otherwise normal users see nothing at all.
- Clicking it turns the screen into a two-panel view: the live page on one side, the guide video on the other. Nothing reloads, nothing is remounted, no work is lost.
- The layout follows the same behaviour as the Courses split view: two columns on a wide screen, two stacked rows on a narrow one, with the same three positions — **Page only · Split · Video only**.
- Standard controls only: play/pause, progress bar, time, volume, fullscreen, close.
- Closing returns to the full page instantly. Any form being filled, lesson note being edited or assignment being created is untouched.
- Nothing autoplays. The guide is opened deliberately by the user.

## What the administrator experiences

- On any page, the administrator sees the same control plus a small **Manage** action, even when no video exists yet.
- The manage panel is deliberately tiny: status (Published / Unpublished), title, description, and `Preview · Replace · Delete · Publish/Unpublish`, or `Upload Guide Video` when the page has none.
- Replacing a video makes the new file the active guide immediately; the previous one stops appearing for normal users.
- A single administrator list of every page and whether it has a guide, for an overview.

## Who can manage

Guides are platform instructional content, so management follows the existing platform-admin capability (platform owner and co-admin). Teachers, schools, parents and students watch only — no upload, replace or delete controls are rendered for them, and the database refuses those writes regardless.
