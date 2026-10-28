# Slide Media — Repair Capture, Add Real Screenshot, Source Menus for Image & Video

The existing Slide/Canvas system stays exactly as it is (Canvas list, Slide 1 of N,
Previous / Next / Preview / Capture / Import image / Import video / Add Slide, docked
resizable panel with its own scrolling). Only the media layer is repaired and extended,
and everything still ends up as a normal slide object on the currently open slide.

## What the code shows today

- One media pipeline already exists and is correct in principle: every entry point calls
  `addSlideItem(openId, …)`, so items are already owned by the open slide only, and
  `SlideCanvas` already gives select / move / 8-handle resize / z-order / delete.
- Capture uses `SnipOverlay` → `captureNoteSelection` (live note nodes) with a
  `html-to-image` raster fallback. The confirm handler runs `try { … } finally { … }`
  with **no `catch`**: if either path throws (raster failure, oversized canvas, media in
  the selection), the promise rejects silently — the overlay just sits there, no message,
  nothing inserted. That is the shape of "Capture does nothing".
- There is no screen capture anywhere in the app: `getDisplayMedia` appears in zero files,
  so "Screenshot" as described does not exist yet.
- Import image / video call `pickFile()`, which opens the OS file picker immediately —
  no Gallery / File / MyGPL choice, and no path into the GPL asset library.

The exact capture failure on this note is not yet confirmed (nothing in the console
snapshot), so step 1 is to reproduce it with the failure surfaced rather than assume.

## Plan

### 1. Make Capture report and survive failures (first step)
Wrap the confirm handler in `SnipOverlay` in a real try/catch: on failure show
`Capture failed. Please try again.`, keep the selection so the teacher can retry, and log
the underlying error for diagnosis. Then reproduce Test 1 and Test 2 from the request and
fix whichever branch actually throws:
- Live-node path: keep it as the preferred result (mathematics stays real mathematics).
- Raster path: capture the true visual — clone-based rasterisation at device pixel ratio,
  white backing, existing `data-slide-chrome` filter so panel/overlay chrome is excluded,
  and skip any element that cannot be inlined instead of aborting the whole capture.
Capture remains MyGPL-only and keeps its current overlay look.

### 2. Screenshot — a genuine screen capture, separate from Capture
Add a **Screenshot** button next to Capture (same pill style). It uses the browser screen
capture API (`getDisplayMedia`), so the teacher can pick a screen, a window or a browser
tab — including another application, a website, a PDF or an image outside MyGPL:
1. Teacher clicks Screenshot → the panel hides its chrome and the browser's own
   screen/window/tab chooser opens.
2. The chosen surface is grabbed as a single high-resolution frame.
3. A crop step then lets the teacher drag a rectangle over that frame for custom
   selection, or accept the whole surface for full-screen/window capture.
4. The result is inserted into the currently open slide, and the panel returns to exactly
   the slide and canvas it was on — no new slide, no reset, no navigation, nothing lost.
If the API is unavailable or permission is refused, show
`Permission required to capture your screen.` with a retry action, and leave the slide
untouched. Capture and Screenshot stay two separate buttons and two separate code paths.

### 3. Import Image / Import Video — source menu
Clicking either button no longer opens the file picker. It opens a small modal in the
current MyGPL style:

```text
Import Image                       Import Video
Where would you like to get        Where would you like to get
the image from?                    the video from?

  Gallery   Choose an image from your device.
  File      Browse files on your device.
  MyGPL     Choose from your MyGPL library.
```

- **Gallery** — opens the device picker (`capture`/gallery-friendly input on tablets and
  phones, falls back to the normal picker on desktop).
- **File** — the normal file picker, accepting PNG / JPG / WEBP / GIF / SVG for images and
  MP4 / MOV / WEBM for video, with a clear message when a file type or size is rejected:
  `Unable to import this file. Please choose another file.`
- **MyGPL** — a picker over the existing GPL asset library (Session → Sub-Session → asset
  grid, reusing the current library data layer), filtered to images or videos. Selecting
  an asset inserts it by reference, no re-upload.

### 4. One media pipeline
Capture, Screenshot, Import Image and Import Video all funnel into a single
`insertSlideObject` helper that owns: upload-or-reference, default placement and size,
next z / next reveal step, optimistic insert, selection of the new object, and the error
message on failure. No second media system, no duplicate insert logic.

### 5. After insertion
Nothing new to build for editing — the inserted object is an ordinary slide item, so
select / move / resize / reposition / bring forward / send back / delete already work, and
a **Duplicate** action is added for parity with the request. Slide ownership is unchanged:
items are keyed to the open slide, so Slide 1's image stays on Slide 1 when the teacher
moves to Slide 2 and back, and nothing is ever written into the lesson note.

### 6. Responsive
The media buttons stay in the existing wrapping toolbar row so they never disappear as the
panel narrows; the source modal is a centred sheet that fits narrow panels and tablets.
Existing panel scrolling and the resize grip are untouched.

## Technical notes

- Edited: `src/components/lessonnotes/slides/SnipOverlay.tsx` (error handling, raster
  quality), `SlidePanel.tsx` (Screenshot button, source menus, single insert helper),
  `SlideCanvas.tsx` (Duplicate action), `src/lib/lessonnotes/slides.ts` (shared insert +
  external-URL item support if a MyGPL asset is referenced rather than copied).
- New: a screen-capture helper (`getDisplayMedia` → frame → crop), an
  `ImportSourceDialog`, and a `MyGplMediaPicker` built on `src/lib/gpl/assetLibrary.ts`.
- Storage: the private `slide-media` bucket and its owner-scoped policies already exist
  and are reused; MyGPL assets keep their own storage path or external URL.
- No database schema changes are required for uploads; if referencing a MyGPL asset by URL
  needs a column, it is added as an additive, nullable column with a sanitiser default so
  existing slides keep loading.
- Acceptance: the seven tests in the request are run in the preview before this is
  reported complete, including Slide 1 / Slide 2 persistence.
