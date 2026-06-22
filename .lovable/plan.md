# Floating Number AI ↔ Lesson Note Generator Integration

Make the Floating Number AI a co-author of the lesson, not a side chatbot. It continuously observes the lesson the teacher is generating, shares the same knowledge base (laws, corrections, uploaded docs), and refuses to generate floating numbers until every element of the source equation is accounted for.

## 1. Shared Lesson Context Layer

Create a single source of truth that both the Lesson Note Generator and the Floating Number AI read from and write to.

New module `src/lib/floating/lessonContext.ts`:
- `LessonContext` type: `{ notebookId, subsectionId, topic, objectives[], sections[], workedExamples[], activeLineId, activeStructure, lastTeacherCorrections[], availableLaws[], draftLaws[], knowledgeDocs[] }`.
- React context provider `LessonContextProvider` mounted at `NotebookEditorPage` and `FloatingNumbersPage` (both already share `notebookId`/`subsectionId` in the route).
- Hook `useLessonContext()` exposes the snapshot + `patchContext(partial)`.

Wiring:
- `useNotebook` already loads notebooks/sections/subsections/blocks — extend it to publish topic/objectives/worked-example blocks into `LessonContext` on every change.
- `FloatingWorkspace` and `FloatingNumbersPage` patch `activeLineId` / `activeStructure` when selection changes.
- `notebook-ai` edge function streams generated example blocks; on each completion, client appends to `workedExamples[]` and notifies the AI panel.

## 2. Live Lesson Awareness in the AI

`AssistantPanel` already sends `selections` + `lineId`. Extend the payload with a compact `lessonContext` block:

```
{ topic, objectives, recentExamples[3], activeLine, activeStructure,
  approvedLawIds[], draftLawIds[], knowledgeDocIds[] }
```

Edge function `floating-assistant/index.ts`:
- Accept `lessonContext` and inject a structured "LESSON STATE" section into the system prompt above the tool list.
- On every turn, hydrate full law text + doc excerpts server-side from `floating_law_library`, `floating_law_drafts`, `floating_knowledge_documents` using the IDs (avoids bloated client payload).
- New tools:
  - `analyze_example({ exampleText })` → returns detected structures (fraction scaffold, polynomial num, factored denom, variables, operators, containers, existing floating elements) using the existing `elementDetector` + a structural classifier.
  - `propose_new_law({ name, statement, rationale, examples[], counterExamples[] })` → writes to `floating_law_drafts` with `status='proposed'`. Never auto-activates.
  - `lookup_law({ query })` → semantic-ish search over approved + draft laws.

## 3. Auto-Analysis Pipeline on Lesson Generation

When the Lesson Note Generator (notebook-ai) emits a new worked example block:
1. Client appends block to notebook as today.
2. Client fires `analyzeExample(blockId, text)` → calls a new edge function `floating-analyze` (or reuses `floating-assistant` with `mode: 'analyze'`) that runs `elementDetector` + structure classifier server-side.
3. Result stored in new table `floating_example_analyses` (see §5) and broadcast into `LessonContext.workedExamples[i].analysis`.
4. The AssistantPanel surfaces a non-intrusive "Analyzed ✓ N structures detected" chip per example, expandable to show the breakdown.

This makes the analysis available to the Floating Number Generator before the teacher ever clicks into a line.

## 4. Unified Knowledge Base

Today: `floating_law_library`, `floating_law_drafts`, `floating_knowledge_documents` are already scoped per user.
Changes:
- Add `lesson_topic text[]` and `tags text[]` to `floating_law_library` and `floating_law_drafts` so laws can be filtered by current topic.
- Add `source_kind` to `floating_law_drafts` enum: `ai_proposed | teacher_authored | derived_from_correction`.
- New table `floating_teacher_corrections` capturing every approve/undo/restructure event with: `line_id, before_chips, after_chips, reason, law_refs[], created_by`. Already partially covered by `floating_chip_snapshots` + `floating_restructure_events` — add a `reason` + `law_refs` column to `floating_restructure_events` rather than a new table.
- `notebook-ai` (Lesson Generator) gains read access to the same law library so generated examples respect approved laws (system prompt injects "Approved laws for topic X: …").

## 5. New / Changed Tables (single migration)

```
floating_example_analyses (
  id uuid pk, user_id uuid, notebook_id uuid, subsection_id uuid,
  block_id uuid, example_text text, structures jsonb,
  detected_elements jsonb, created_at timestamptz
)
ALTER floating_law_library ADD COLUMN lesson_topics text[], tags text[];
ALTER floating_law_drafts  ADD COLUMN lesson_topics text[], tags text[], source_kind text;
ALTER floating_restructure_events ADD COLUMN reason text, law_refs uuid[];
```

All with the standard `GRANT` block + RLS scoped to `auth.uid()`.

## 6. Hard Completeness Gate

Already partially in `verifier.ts`. Promote it to a non-bypassable gate:
- Centralize in `src/lib/floating/completenessGate.ts` and mirror in `supabase/functions/floating-assistant/verifier.ts`.
- Checklist enforced server-side before `apply_chips` can return `verification_pass: true`:
  variables, coefficients, operators, scaffolds, fractions, exponents, functions, matrix elements, integral/limit bounds, brackets, equalities.
- If any element is missing, the tool result must include `missing[]` and the Approve button stays disabled (already wired in `AssistantPanel`).
- Add a UI "Coverage Report" card rendered from the latest tool trace so the teacher sees exactly what was/wasn't accounted for.

## 7. New-Law Discovery Flow

When the AI cannot fully explain a structure with approved laws:
1. `verify_chips` returns `status: 'NEEDS_NEW_LAW'` with `unknownStructure` description.
2. Assistant auto-calls `propose_new_law` and renders a "Proposed Law" card with: name, statement, rationale, 2 examples, 1 counter-example, "Approve" / "Edit" / "Reject" buttons.
3. Approve → moves row from `floating_law_drafts` to `floating_law_library` (status `approved`, version 1). Reject → marks draft `rejected`. Both events recorded for future learning.
4. Approved laws immediately appear in `AiSettingsPage` and are injected into subsequent prompts.

## 8. UI Changes

- `AssistantPanel`: add a collapsible "Lesson Context" strip above "Selected Context" showing topic, active example, active line.
- `AssistantPanel`: add "Coverage Report" + "Proposed Law" message cards.
- `FloatingNumbersPage`: subscribe to lesson context; if user navigates from a lesson note line, pre-seed the active example into selections.
- `NotebookEditorPage`: when a worked example is generated, show a tiny "AI analyzed" badge that links to the floating page with that line pre-selected.
- `AiSettingsPage`: add tabs for Approved Laws / Draft Laws / Teacher Corrections / Knowledge Docs, all filterable by lesson topic.

## 9. Files Touched

New:
- `src/lib/floating/lessonContext.tsx` (provider + hook)
- `src/lib/floating/completenessGate.ts`
- `src/lib/floating/structureClassifier.ts`
- `supabase/functions/floating-assistant/lessonContext.ts` (server-side hydrator)
- `supabase/migrations/<ts>_floating_lesson_integration.sql`

Edited:
- `src/hooks/useNotebook.ts` — publish topic/examples to context
- `src/pages/NotebookEditorPage.tsx` — wrap in provider, emit analysis on new examples
- `src/pages/FloatingNumbersPage.tsx` — consume provider, pre-seed selections
- `src/components/floating/AssistantPanel.tsx` — lesson context strip, coverage + proposed-law cards, include `lessonContext` in payload
- `src/pages/floating/AiSettingsPage.tsx` — corrections tab, topic filters
- `supabase/functions/floating-assistant/index.ts` — accept lessonContext, hydrate KB, add `analyze_example`, `propose_new_law`, `lookup_law` tools, enforce completeness gate
- `supabase/functions/notebook-ai/index.ts` — inject approved laws for current topic into system prompt

## 10. Out of Scope (ask before adding)

- Vector/semantic search over knowledge docs (currently keyword + topic filters).
- Realtime broadcast across multiple teacher devices (single-user assumption preserved).
- Auto-generating floating numbers from the Lesson Generator without teacher entering the Floating page.

---

Confirm and I'll implement. Tell me if you want any of the §10 items pulled in, or if the new-law approval flow should live in the AI Settings page instead of inline in the chat.
