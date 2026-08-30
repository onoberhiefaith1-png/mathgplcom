# Upload profile photo, cover and intro video

Right now the Community profile editor asks for typed links: "Profile photo URL", "Cover image or video URL", "Introduction video URL". A teacher has no link to paste, and the photo field currently holds an internal file path that Community cannot display. Replace all three with real upload controls.

## What the teacher will see

Three upload cards at the top of the Community profile editor:

1. **Profile photo** — round preview, "Upload photo" / "Replace" / "Remove". Images only.
2. **Cover image or video** — wide banner preview. Accepts an image or a video; the cover type is set automatically from the file that was uploaded, so the IMAGE / VIDEO buttons disappear.
3. **Introduction video** — video preview with playback, "Upload video" / "Replace" / "Remove".

Each card shows a progress state while uploading, then the real preview exactly as it will appear on the public profile. No link boxes anywhere.

Limits, enforced in the browser with a clear message: photo up to 5 MB, cover image up to 10 MB, cover video and intro video up to 200 MB each.
