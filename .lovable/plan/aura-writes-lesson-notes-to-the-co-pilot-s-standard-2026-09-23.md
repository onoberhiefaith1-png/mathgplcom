# Aura writes lesson notes to the Co-Pilot's standard

Right now they are two separate minds with two different levels of training. The
Co-Pilot has the full lesson-note training — the teaching reference, the
benchmark worked solutions, the rendering rules, the structure rules, the
completeness and question-lock checks, and the professional editor standard.
Aura only carries a short summary of the maths rules in her briefing, so her
notes come out thinner than the Co-Pilot's.

They stay two AIs. What changes is that Aura is given the Co-Pilot's whole
training, and she writes lesson-note content through the same trained generator
the Co-Pilot uses — so the same note the Co-Pilot can produce, Aura can produce.

## What Aura gains

1. **The same writer.** When Aura writes an introduction, an explanation, an
   example question, a worked solution, classwork, homework or an assessment
   question, she asks the same trained lesson-note generator the Co-Pilot uses,
   then places the result into the note in the right session. She no longer
   invents the wording herself.
2. **The same plan before the writing.** For a whole note, Aura first asks the
   same blueprint step the Co-Pilot uses (what sections, in what order, at what
   difficulty), tells you the plan in a couple of sentences, then builds it
   section by section, carrying the lesson-so-far forward so nothing repeats and
   difficulty rises properly.
3. **The same review pass.** After a section is written it goes through the same
   check the Co-Pilot uses. If a solution comes back incomplete or the question
   has been altered, it is refused and rewritten — never written into the note
   quietly.
4. **The same training in her own head.** The Co-Pilot's standards are also
   added to Aura's briefing, so when she edits a single line, corrects a step,
   or teaches out loud, she obeys the same rules: one micro-step per line, the
   question restated verbatim, stacked fractions, no calculator or code
   notation, no skipped transitions.

## What does not change

Two separate AIs, two separate entry points. The Co-Pilot inside the lesson-note
page is untouched — same procedure, same screens, same behaviour. Aura's voice,
call, Smartboard, Floating Numbers, Game, classes and assignment confirmations
all stay exactly as they are. The mathematics engine remains the only producer
of teacher-facing maths; Aura does not become a second maths engine.

## Technical notes

- Share the standards instead of copying them: a new client-safe module
  `src/lib/agent/lessonKnowledge.ts` re-exports the standard strings already in
  `supabase/functions/notebook-ai/` (`pedagogyReference`, `renderingStandard`,
  `structuralStandard`, `workspaceStandard`, `tableStandard`,
  `benchmarkStandard`, `continuityStandard`, `integrityStandard`,
  `solutionCompletenessStandard`, `copilotTrainingStandard`) via the same
  `sharedKnowledge` composition. `allowImportingTsExtensions` is already on, so
  the existing `.ts` imports resolve from `src/` without duplicating text. One
  source of truth — editing a standard updates both AIs.
- `systemPrompt.ts`: inject `solutionKnowledgeBlocks(PEDAGOGY_REFERENCE)` into
  Aura's briefing, keeping the existing MATHEMATICS and lesson-note-order
  sections. Call turns keep the cached per-session briefing, so the longer
  briefing is built once per call and does not affect the sub-second target.
- New server-side hands in `hands.server.ts`, invoking `notebook-ai` exactly as
  `generate_floating_numbers` already does:
  - `generate_lesson_content` → `mode: "generate"` with `sectionKind`,
    `blockKind`, topic/subtopic/subject, `lessonContext` (lesson-so-far built
    from the note Aura has already written), `activeQuestion` +
    `inheritedContext: true` for solution blocks, then appends the returned
    lines with the question's `subsectionId`.
  - `plan_lesson_note` → `mode: "blueprint"` for the section plan.
  - `review_lesson_section` → `mode: "review"` for the check pass.
  Register them in `toolTypes.ts` (full-abilities tier, not the small call
  tier) and merge in `tools.server.ts`.
- Error contracts are surfaced, not swallowed: `missing_inherited_question` and
  `incomplete_solution` (422) make Aura fix the note structure or regenerate,
  and say plainly what happened — never write a partial solution.
- Prompt order rule stays: note → session → question → solution → highlight →
  generate Floating Numbers → Smartboard test → assign.
- Tests: `src/lib/agent/__tests__/` gains checks that Aura's briefing contains
  the Co-Pilot standards, that the new tools are in the manifest and absent from
  the call tier, and that a solution request without an inherited question is
  refused.
