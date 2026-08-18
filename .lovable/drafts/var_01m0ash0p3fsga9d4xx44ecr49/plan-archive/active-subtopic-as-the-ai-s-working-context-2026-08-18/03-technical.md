## Technical notes

**New module `src/lib/lessonnotes/aiContext.ts`** — the central lesson AI context:

```ts
interface LessonAiContext {
  subject: string;          // "Mathematics"
  topic: string;            // notebook topic — never changed by subtopic edits
  activeSubtopic: string;   // last confirmed subtopic
  activeSubtopicPos: number | null; // heading position in the document
  previousSubtopics: string[];      // history, order of first use
}
```
Exposed through a small React context + `useLessonAiContext()` (provider mounted in `DocumentEditor`, seeded from `notebookContext`, so the notebook subtopic is the initial active subtopic). `setActiveSubtopic(title, pos)` pushes the outgoing value into `previousSubtopics` (deduped) and never writes `topic`.

**`src/components/lessonnotes/DocumentEditor.tsx`**
- `insertSubtopic(title)`: trim + validate; if a level‑1 subtopic heading with the same title (case‑insensitive) already exists, don't insert — move the sensor under it and activate it. Otherwise insert the heading as today, then activate.
- Subtopic composer gains an `Enter` button calling the same commit path as the keyboard Enter, plus an inline validation message for empty input.
- `contextAt(pos)` becomes the single resolver: it returns `{ subject, topic, subtopic }` where `subtopic` is the store's `activeSubtopic` when the caret is at/below `activeSubtopicPos`, otherwise the nearest subtopic heading above `pos` (so editing older sections still generates for their own subtopic). It never falls back to the stale `notebookContext.subtopic` once a subtopic is active.
- Replace the remaining direct `ctxRef.current?.subtopic` reads with `contextAt(...)`:
  - `offerGeometryMap` → `buildMapFn` `topic` (line ~597)
  - `persistAndOfferFloating` → `problem` / `subtopic` (lines ~666-669)
  - whole-note and cursor AI edit calls (`ctx: ctxRef.current`, lines ~2237, ~2262) and the `mode: "edit"` payload (~2341)
  - geometry pass (~1396) keeps `contextAt` but drops the notebook fallback
- Selection/click on a level‑1 subtopic heading calls `setActiveSubtopic`, keeping the badge honest as the teacher moves through the note.
- New `ActiveSubtopicBadge` beside the Section/AI controls: shows `Topic` and `ACTIVE SUBTOPIC`, with a dropdown listing the note's subtopic headings to switch context (jumps the sensor, sets active, toasts the transition).

**No backend change required.** `notebook-ai` already receives `topic`/`subtopic`/`subject`; it will now always receive the confirmed active subtopic. The generate/geometry prompts already treat `subtopic` as the working context, and `lessonContext` collection is already scoped from the nearest subtopic heading — that scope now starts from `activeSubtopicPos`.

**Unchanged:** existing content is never regenerated or deleted on a subtopic switch; QUESTION_LOCK, inheritance, one-question-one-diagram and Geometry Map rules all stay as they are.

**Verification (manual, in the preview):** confirm subtopic A → Generate Introduction is about A; confirm subtopic B → Introduction, question, diagram and solution are about B; switch back to A → new content is about A and B's content is intact.
