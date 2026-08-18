# AI Question Generation Pipeline (Understand → Structure → Generate → Solve → Validate → Map)

Today the AI Generate button in a section heading does one thing: it builds a prompt, calls `notebook-ai` once, and immediately turns the returned text into document nodes (`handleSectionAi` in `DocumentEditor.tsx`). There is no blueprint, no separate diagram/solution stage, no validation, and no shared id binding question → diagram → solution → map. Failures therefore surface as a single opaque "AI failed" toast — the "Cannot read properties of null (reading 'chain')" message in the screenshot is one of those: it comes from a later insertion step, not from the model call. The exact null object is not yet confirmed, so stage 0 below pins it down before the rewrite lands on top of it.

## Stage 0 — Reproduce and name the failure

- Instrument the generate path so every insertion step reports which stage it was in and which object was missing, and reproduce the pulley question from the screenshot.
- Fix the actual null (the insertion helper is being handed an editor/node reference that no longer exists after the awaited model call) and make every stage re-resolve its anchors from the live document instead of trusting values captured before the await.
- No stage may assume the previous stage's object exists: if it is missing, it either creates it or stops with a named error.

## 1. Material intake (one input, four sources)

The AI popover keeps its current shape but treats all material as one context bundle:

- **Type** — free instruction (already works).
- **Voice** — transcribed first, then appended to the same instruction box; never a separate generation route.
- **Image** — photos/screenshots of textbook, board or handwritten questions.
- **File** — PDF / Word / image documents, parsed to text and diagram description.

All sources merge into a single `material` payload. Images and files are analysed for mathematical constraints (values, units, required precision, labels), not described as pictures.

## 2. Add Context strip

Under the material box, a compact context row the teacher can fill in or leave blank: Topic, Subtopic, Level, Difficulty, Question count, Diagram required, and "Reproduce / Modify / Similar". Topic and subtopic act as hard constraints on generation, and difficulty is structural (number of chained relationships), not just bigger numbers.

## 3. Blueprint before generation

Generate now runs as an explicit state machine instead of one call:

```text
EMPTY → INPUT_RECEIVED → ANALYSING → BLUEPRINT_READY
      → GENERATING_QUESTION → GENERATING_DIAGRAM → GENERATING_SOLUTION
      → VALIDATING → READY | ERROR
```

The **blueprint** is structured data produced first: source, topic, subtopic, objective, mathematical objects, given values with units, unknown, required methods/theorems, diagram requirement, answer format. For the screenshot question that is: two unequal pulleys, r = 5 cm, R = 8 cm, d = 17 cm, external continuous belt, π = 3.142, total belt length, 3 s.f., diagram with labels A, B, P, Q.

"Similar question" preserves that structure (two unequal circles, external tangents, arc lengths, total length, rounding) and changes only values, context and labels.

## 4. Question, diagram and solution as one object

Generation proceeds question → diagram → solution, all bound to one generation id and the existing owner-question id, so:

- The diagram is built from the same mathematical model as the question text (no decorative second diagram — the existing one-question-one-diagram lock stays).
- The solution is generated from the validated question, not from prose.
- The Geometry Map is generated only from a validated solution, exactly as it works now.

## 5. Validation gates

Before anything is shown:

- **Mathematical** — recompute the intermediate quantities and final answer, check units and significant figures.
- **Diagram ↔ question** — every value and label named in the question exists in the scene with the right relationship.
- **Question ↔ solution** — the solution answers the question that was generated.

A failed gate regenerates that stage only and reports which gate failed ("Diagram generation failed — the question generated correctly but the diagram could not be validated"), never a bare "AI failed".

## 6. Review before it lands

Generation ends in a review step showing Question / Diagram / Solution with Accept, Regenerate, and Modify (change instruction, difficulty, values, or diagram) — regenerating one part does not restart the whole pipeline. Progress is shown in teacher language: Understanding material → Building question → Creating diagram → Solving → Checking.

## Technical notes

- New client module `src/lib/lessonnotes/ai/pipeline/` holding: `material.ts` (merge text/voice/image/file), `blueprint.ts` (blueprint type + extraction call), `generate.ts` (stage runner and state machine), `validate.ts` (maths, diagram↔question, question↔solution gates), `generationObject.ts` (single generation id binding question/diagram/solution/map).
- `notebook-ai` edge function gains explicit modes: `blueprint`, `question`, `diagram`, `solution`, `verify` — reusing the current standards files (QUESTION_LOCK, pedagogy, inheritance, output hygiene, geometry) unchanged; existing `generate`/`scan`/`floating` modes keep working.
- `DocumentEditor.tsx` `handleSectionAi` becomes a thin driver over the stage runner; all document positions re-resolved per stage from the live doc.
- `AiPopover.tsx` gains the context strip, file input, and stage progress; voice keeps the current transcription hook.
- Review UI as a new `AiGenerationReview` panel; Accept performs the existing insertion path so nodes stay ordinary editable objects.
- Geometry Map wiring is unchanged — it continues to read the validated solution.
- Rollout: stage 0 fix + state machine and named errors → blueprint stage → diagram/solution binding and validation gates → context strip, file input, review panel.
