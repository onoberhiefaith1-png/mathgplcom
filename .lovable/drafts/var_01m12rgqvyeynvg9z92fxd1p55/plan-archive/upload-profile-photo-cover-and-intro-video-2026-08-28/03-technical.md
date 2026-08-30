## Technical notes

**Storage.** Community profiles are viewable by signed-out people, and the person page renders `avatarUrl`, `coverUrl`, `introVideoUrl` straight into `<img>` / `<video>` `src`. So these need a public bucket, `community-media`, created with the storage tool, with write policies on `storage.objects` scoped to `auth.uid()` as the first path segment (`<uid>/photo-…`, `<uid>/cover-…`, `<uid>/intro-…`) and public read. The staged migration in this draft carries the policies; the bucket itself is created directly.

**New helper** `src/lib/community/media.ts`:
- `uploadCommunityMedia(file, kind)` → uploads to `<uid>/<kind>-<timestamp>.<ext>`, returns the public URL from `getPublicUrl`, and meters storage usage like the existing avatar/course-media helpers.
- `removeCommunityMedia(url)` → deletes the object when the URL points at our bucket (ignores anything else).

**New component** `src/components/community/MediaUploadField.tsx` — label, hidden file input, accept list, size cap, busy state, preview (round image / banner image / `<video controls>`), Replace and Remove. Purely presentational plus the helper call.

**Editor** `src/pages/profile/CommunityProfileEditorPage.tsx` lines 287–327: replace the three `Field`s and the cover-type buttons with three `MediaUploadField` uses. Cover kind is derived from the uploaded file's MIME type and patched together with `coverUrl`.

**Existing values.** Any profile whose `avatar_url` still holds an internal path (not `http`) shows the initials fallback until the teacher uploads once; the person page and result card already guard on truthiness, so a `hasHttpUrl` check keeps stale paths from rendering as broken images.

No changes to `people.ts` shapes, completeness rules, or moderation — the fields keep their names and types.
