## Technical notes

**Co-Pilot rendering.** `CoPilotPanel.tsx` currently renders `{m.text}` inside a
`whitespace-pre-wrap` bubble (line ~71). Replace that with the existing
read-only renderer `renderMathInline` from `src/lib/notebook/mathRender.ts`,
after `sanitizePresentation`, splitting the reply into lines so prose stays prose
and mathematical fragments are drawn. Proposal summaries, step labels and
"preserves" lines use the same helper. No new renderer, no new parser.

**Shared knowledge layer.** `supabase/functions/notebook-ai/index.ts` already
loads `BENCHMARK_STANDARD`, `PEDAGOGY_RULES` and `SOLUTION_COMPLETENESS_STANDARD`
for solution generation (~line 840) but the `edit` mode (~line 1566) omits them
unless `forceAllStandards` is set, and never loads the engine knowledge or
copilot training standard. Add one exported bundle (e.g.
`sharedKnowledge.ts` → `solutionKnowledgeBlocks()` / `editKnowledgeBlocks()`)
composed from the existing standard modules and consume it from both the
generation path and the `edit` path. No standard text is rewritten.

**AI Edit solution intent.** In `edit` mode, detect a generate/complete/improve
solution intent from the instruction and selection kind; when present, load the
full solution knowledge bundle, require the Understand → Method → Working →
Explanation → Answer shape with one micro-step per line, and run the existing
solution completeness verifier before returning. Existing directive rules
(matrix, Smart Table, rendering, no raw markup) stay as they are.

**AI Edit context.** `DocumentEditor.tsx` already builds a workspace manifest for
generation; pass the same manifest plus the nearest question, existing solution,
tables and diagram descriptors into the `edit` request so completion has context
while replacement stays bounded to the captured range.

**Session action.** `SelectionToolbar.tsx` gains a Session button next to AI Edit,
with a new `onMakeSession(snap)` prop. `DocumentEditor.tsx` implements it: read
the selection slice, derive the session kind with `structuralHeadingKind` /
`detectSectionKind` from `src/lib/lessonnotes/sectionKinds.ts` (stamp wins,
strict text fallback), then in one transaction replace the range with a stamped
`SectionHeading` (`sessionKind`, `sessionOrdinal`) followed by the selection's
own nodes — headings already present in the selection are consumed rather than
duplicated. `buildLessonOutline` and `syncDocumentToNotebook` then pick the
segment up with no further change, which is what makes Present, the Smartboard
and session navigation see a genuine session.

**Tests.** Co-Pilot bubble renders `A \cup B` as `A ∪ B` and never leaks a
backslash; `edit` mode with a solution instruction returns a multi-step solution
that passes the completeness verifier; Session conversion on a manually typed
Example produces exactly one heading with the right kind, preserves inline
maths, leaves no duplicate, and appears in the lesson outline. Existing
lesson-note suites keep passing.

**Out of scope.** AI Builder prompts and architecture, the geometry engines,
Smart Table, Floating Numbers, and the generation modes other than the shared
knowledge extraction.
