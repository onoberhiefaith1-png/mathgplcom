# MathGPL Copilot — fixed procedure, intelligent inside it

The Copilot already exists as a docked chat that discusses and proposes actions. This plan turns it into the staged teaching assistant you described: a fixed lesson-building procedure, with natural professional conversation and real mathematical judgement inside each stage.

## The procedure (never re-invented)

```text
Stage 1  Greeting        knows subject / topic / active subtopic
Stage 2  Structure       lesson-structure card with number controls
Stage 3  Additional info text, voice, image, screenshot, file, questions
Stage 4  Analysis        reads the material: level, style, method, progression
Stage 5  Build           works section by section, narrating as it goes
Stage 6  Supervision     teacher interrupts at any point; Copilot adapts
```

The Copilot moves forward through these stages on its own. It never asks "how many examples?" — the numbers are controls. It never blocks the teacher: with no additional material it proceeds on the current context alone.

### Stage 2 — the structure card

The first thing the Copilot produces, always. A card in the conversation with one row per section and a stepper on each:

Introduction 1 · Explanation 1 · Example 3 · Classwork 2 · Exercise 3 · Assignment 2 · Conclusion 1

The teacher edits the numbers, then presses **Use this structure**. Section kinds come from the note's existing kind list, so labels stay app-owned.

### Stage 3 — additional information

An intake strip on the card: type a note, record a voice note (existing voice input + transcription), attach an image / screenshot / textbook photo / file, or paste an existing question. **Skip** is always available and is a normal, non-apologetic path.

### Stage 4 — analysis, not acknowledgement

Attached material is analysed and reported back in teacher language: the mathematical level it implies, the question style and structure, the method being practised, the difficulty progression, and the terminology. That reading is then carried into every generation call for the rest of the build, so questions inherit the teacher's style instead of being number-swaps.

### Stage 5 — building with narration

The Copilot walks its own plan: introduction, explanation, then examples in rising difficulty, then classwork drawn only from methods already taught, then exercise, assignment, conclusion. Each item is generated through the note's existing generators — nothing new writes mathematics. While it works it says what it is doing and why ("Example 3 will make students choose the factorisation structure themselves"), ticking items off as they land.

Safe additive work runs without asking. Anything that replaces or deletes teacher content stops and asks. No "Approve?" after every step.

### Stage 6 — interruption

The teacher can type at any time: "Example 2 is too easy", "make the next classwork harder", "don't use that example", or highlight a block and say "correct this". The Copilot resolves the reference from where it is in the plan and what the cursor/selection is on, changes only that item, and preserves the rest.

## Mathematical intelligence

Before a generated question is accepted into the note, the Copilot checks it rather than trusting it: is it valid, is it still solvable by the intended method, does it actually test the same concept, does it move the difficulty in the intended direction, does it fit what has already been taught. Changing numbers is not treated as changing the mathematics — a replacement must be structurally different. When it cannot judge safely it says so and asks for the reference material instead of inventing.

## MathGPL system knowledge

The Copilot is given a description of the app it works in — lesson notes and subtopics, Smartboard, class notes, assignments and assessments, Adventure, Game Builder, Skill Builder, Geometry 2D / 3D, the geometry calculator, Smart Table, matrices, the notation editor, diagrams, assets, question and solution generation, Geometry Relationship Mapping, progress — so "what is MathGPL?" gets a real answer and the teacher never has to explain the app to it.

Boundary: it knows the admin and platform dashboards exist and what they are for, and has no access to their records, private forms, billing, or other accounts. It works only inside the teacher's own workspace content.

## Diagrams and geometry

- The Copilot produces the diagram directly into the note when one is needed; it never simulates a teacher dragging points in the 2D/3D editor. The teacher then edits it with the existing geometry tools.
- One question owns one diagram and one solution. The existing question-lock and inheritance rules stay in force.
- For 3D it states what representation the lesson needs and hands that to the teacher's 3D tool rather than pretending to author it.
- Geometry Relationship Mapping keeps its order: question → solution → principles actually used → relationship map → student guide, with no measured values and no answer leak.

## Language

Professional teacher-to-teacher English with genuine variety — no fixed stock sentences, no repeated "I've reviewed your request". Tone follows the moment: brisk while building, careful when a teaching decision is at stake.

## Technical notes

- **Procedure state machine** — new `src/lib/lessonnotes/copilot/procedure.ts`: stage (`greeting` | `structure` | `material` | `analysis` | `build` | `idle`), the structure counts, the attached material, the analysis result, and the build queue with per-item status. `conversation.ts` drives the stage instead of treating every turn as standalone.
- **Structure card + intake** — new components under `src/components/lessonnotes/copilot/` (`StructureCard.tsx`, `MaterialIntake.tsx`, `BuildProgress.tsx`), rendered inline in `CoPilotPanel.tsx`. Steppers use `SECTION_KINDS` / `SECTION_LABEL` from `sectionKinds.ts`; voice reuses `useVoiceInput` + the existing `speech-transcribe` function.
- **Backend** — `mode: "copilot"` in `supabase/functions/notebook-ai/index.ts` gains: `stage` in the request, a MathGPL system-knowledge block, the analysis sub-mode (multimodal input for images/files, returning level / style / method / progression / terminology), and a build-narration sub-mode. Existing standards imports (pedagogy, integrity/question-lock, inheritance, structural, rendering, workspace) stay in force; the analysis result is threaded into the `blueprint` and question/solution calls as style constraints. Model: a multimodal Gemini for analysis, and the stronger reasoning model for validation of generated questions.
- **Validation** — a check pass in the copilot backend path that re-reads each generated question against the analysis and the intended method before the client commits it; a failed check is regenerated once, then reported honestly.
- **Actions** — the existing action contract in `copilot/actions.ts` is extended with a batched `buildPlan` run (ordered items from the structure) and selection-scoped `editSelection`; all of them remain thin wrappers over handlers `DocumentEditor.tsx` already owns.
- **Verification** — in the preview on a real note: open the Copilot on a Quadratic Equations · Factorisation note; confirm the structure card appears first with editable numbers; skip material and confirm it still builds; re-run with a textbook photo and confirm the analysis names style and difficulty and that the built examples follow it; interrupt with "Example 2 is too easy" and confirm only Example 2 changes; ask "what is MathGPL?" and confirm a real system answer; confirm no second diagram is created and the Geometry Map still binds to the existing solution.

## Out of scope

Student-facing changes, Smartboard changes, dashboards, and any new geometry, table or generation engine.
