## Goal

Two fixes to AI Lesson Note generation:
1. No raw syntax (markdown, JSON, code fences, LaTeX source, escapes, placeholders) ever reaches the page.
2. Every generated section is written with the full lesson so far as context, so Example 1 → 2 → 3 → exercises form one continuous teaching sequence on the same topic.

## What I verified first

- Generation goes: `DocumentEditor.tsx` `handleSectionAi` (~line 545) → `aiGenerate` (~line 253) → edge function `supabase/functions/notebook-ai/index.ts` mode `"generate"` (~line 567).
- The request currently sends only `topic`, `subtopic`, `subject`, the **current section's own text** as `context`, `currentContent`, `teacherPrompt`, and (solutions only) `activeQuestion`. Nothing from earlier sections is sent — this is the root cause of disconnected/off-topic examples.
- The server already runs a self-correcting validator loop (`generateValidated`, `index.ts:175`) plus `hardStripMath`, but `stripFences` only removes leading/trailing triple backticks. Inline markdown (`**`, `##`, backticks), stray JSON, and escape sequences are not deterministically stripped.
- Rendering into the editor goes through `aiTextToNodes` (safe-ish), but several surfaces render raw strings (`PresentationView.tsx` cover title fallback ~5749, topic/subtopic ~5753/5758, caption ~5787; `AiEditPanel.tsx:186` when `renderPreview` is omitted).

## Part 1 — Clean-output guarantee

**Server (deterministic, runs on every generate/edit response):**
- Add `sanitizePresentation()` in a new `supabase/functions/notebook-ai/outputHygiene.ts`:
  - strip code fences anywhere (not just at the ends), inline backticks, `**bold**`/`*italic*`/`__`/`_` markers, `#`–`######` headings, markdown bullets/numbering artefacts, table pipes.
  - detect and unwrap accidental JSON envelopes (`{"content": "..."}`, arrays of strings) instead of printing them.
  - decode escape residue (`\n`, `\t`, `\"`, `\\`) into real text.
  - remove AI placeholders (`[insert ...]`, `<...>` tags, `{{var}}`, `TODO`, `Solution:`/`Answer:` prefixes).
  - keep the allowed math templates (`\frac`, `\sqrt`, `^{}`, `_{}`) that the renderer intentionally consumes.
- Apply it as the final step of `generateValidated` after `hardStripMath`, and to the `edit` mode return path, so no mode can bypass it.
- Add a residue check that feeds any remaining violation back into the existing re-prompt loop, and record leftovers in `warnings`.

**Client (last line of defence):**
- Run the same rules client-side before insertion: extend `src/lib/lessonnotes/aiToNodes.ts` so `aiTextToNodes` sanitizes markdown/JSON/escape residue before tokenizing into nodes (shared rule list mirrored from the server file).
- Fix the raw render sites: route `PresentationView.tsx` cover-title fallback, topic, subtopic and caption through `SmartboardLessonText`; make `renderPreview` mandatory (or default to the safe renderer) in `AiEditPanel.tsx`.

## Part 2 — Full teaching context before generating

**Client: build a lesson context snapshot.**
New `src/lib/lessonnotes/lessonContext.ts` that walks the TipTap document above the insertion point (same traversal style as the existing `getSolutionSource`) and returns:
- topic, subtopic, subject, curriculum level (from notebook metadata)
- learning objectives and introduction text
- every prior explanation (condensed)
- every prior worked example: problem + method summary
- definitions/notation already introduced
- the index of the section being generated (e.g. "this is Example 3 of this lesson")

Content is trimmed to a token budget: full text for objectives/introduction/most recent 2 examples, one-line summaries for older ones.

**Wire it through.** `aiGenerate` sends a new `lessonContext` field; `handleSectionAi` populates it for every section kind (not just solutions).

**Server: use it.** Extend the `generate` payload type (`index.ts:568`) and add a `LESSON SO FAR` block to the prompt assembly (`index.ts:643`), plus a new continuity standard file `supabase/functions/notebook-ai/continuityStandard.ts` injected into the system prompt:
- stay strictly on the stated topic/subtopic and the method already introduced
- reuse the notation and definitions already given; do not re-define or rename them
- each example must build on the previous one; difficulty rises gradually, never jumps method
- exercises must test exactly what the examples taught
- before writing, restate internally: what's been taught, current notation, current method, logical next step

**Server: continuity validation.** Add a `stage_continuity` check to the validator pipeline that flags a draft introducing a method or notation absent from the lesson context, or drifting off subtopic; failures re-prompt through the existing self-correction loop.

## Technical notes

- No database or schema changes.
- Existing QUESTION_LOCK / inheritance enforcement stays untouched; lesson context is added alongside it, never replacing `activeQuestion`.
- Files touched: `notebook-ai/index.ts`, new `notebook-ai/outputHygiene.ts`, new `notebook-ai/continuityStandard.ts`, `notebook-ai/validator.ts`, new `src/lib/lessonnotes/lessonContext.ts`, `src/lib/lessonnotes/aiToNodes.ts`, `src/components/lessonnotes/DocumentEditor.tsx`, `src/components/lessonnotes/AiEditPanel.tsx`, `src/components/smartboard/PresentationView.tsx`.
- Verification: generate a full lesson (introduction → explanation → 3 examples → exercise) on one subtopic and confirm no raw syntax appears anywhere and each example continues the previous method.
