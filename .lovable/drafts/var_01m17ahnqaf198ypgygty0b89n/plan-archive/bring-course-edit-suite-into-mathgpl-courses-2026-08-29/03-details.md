## Technical detail

Both projects run the same stack (TanStack Start, React 19, Tailwind v4, shadcn), so the copy is direct.

**Copied files** (from the Course Edit Suite snapshot, unchanged logic):
- `src/components/editor/**` — workspace, top bar, timeline, preview players, version bar, workflow bars and all 10 stage panels.
- `src/components/gallery/GalleryPage.tsx`, `src/components/site/WelcomePage.tsx`, `src/components/site/SiteNav.tsx`.
- `src/lib/editor/**` — workflow engine, media, storage (IndexedDB), segmentation, transcription, voice, subtitles, render-video, playback hooks, types.
- `src/lib/ai-gateway.server.ts`.

**Routes added under a `/course-edit` prefix** (so no existing MathGPL route is touched):
- `src/routes/course-edit/route.tsx` — `RequireAuth` + `<Outlet />`, matching how `/course-builder` is gated.
- `.../index.tsx` (studio home), `.../engine.tsx` (workspace, `?project=` search param preserved), `.../gallery.tsx`. Each keeps its own `head()` metadata retitled for MathGPL.
- `src/routes/api/course-edit/speak.ts` and `.../transcribe.ts` — copies of the suite's API handlers, namespaced to avoid clashing with existing `/api` routes. Both read `LOVABLE_API_KEY` inside the handler.

**Navigation:** `SiteNav` is adapted so its first link is **Courses → `/course-builder`**, followed by Studio, Video Engine and Gallery. On `/course-builder`, a **Course Edit** button is added to the header of `src/pages/CourseBuilderLibrary.tsx`.

**Styling:** the suite uses only semantic tokens (`background`, `primary`, `muted`, …) that already exist in MathGPL's `src/styles.css`, so it inherits your theme with no token additions.

**Dependencies to install:** `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `ai`, `@ai-sdk/openai-compatible`.

**Data:** the suite stores its projects and media in the browser's IndexedDB (`mathgpl-video-editor`), exactly as it does today. No database tables, migrations or storage buckets are involved, and no existing course/class data is read or written.
