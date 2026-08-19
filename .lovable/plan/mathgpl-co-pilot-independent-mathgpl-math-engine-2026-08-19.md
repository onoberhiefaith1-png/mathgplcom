# MathGPL Co-Pilot + Independent MathGPL Math Engine

Two teacher-facing AIs, one active at a time, with mathematics owned by a separate, verified engine. Nothing in the lesson editor, geometry, tables, graphs, calculators, floating elements, slides or assets is redesigned.

## 1. Three responsibilities, cleanly separated

```text
Lovable AI        builds the software          (never teacher-facing)
MathGPL Co-Pilot  understands the application  (structure, workflow, editing)
MathGPL Engine    understands mathematics      (generate, solve, construct, verify)
```

Today one backend prompt path serves everything. It splits into two prompt families with their own instructions, their own knowledge, and their own validation. The Co-Pilot never produces mathematics itself: when a request needs maths, it calls the Engine.

## 2. Mode switch replaces the Co-Pilot/Builder toggle

The top-bar selector becomes:

```text
MathGPL Co-Pilot ▾
   • MathGPL Co-Pilot   — Active
   • MathGPL Math Engine
```

- Exactly one is active; the panel header shows "MathGPL Co-Pilot — Active" or "MathGPL Math Engine — Active" and its body visibly changes.
- Co-Pilot active: inline ✨ AI markers stay hidden across sections (as now). Solution, Diagram, Tables, Graph, Assign and Floating remain as ordinary editing tools.
- Math Engine active: those section tools are available again, but every one of them calls the Engine service — never the old generic path.
- The current "Builder" mode is renamed and repurposed into Math Engine mode; the mode value persists per teacher as it does today.

## 3. Panel redesign

- White panel, dark text, light borders, subtle grey separators, generous spacing — matching the lesson canvas. The dark purple/navy chat surface goes.
- Still about one third of the workspace; the lesson note can be expanded to full screen.
- **PLAN / CREATE / "analyse only" controls are removed.** The teacher just talks; the AI decides whether to discuss or act, and asks for approval before major insertions (Approve · Modify · Cancel).
- Progress states reflect real stages only: Analysing the topic → Checking the method → Building the example → Verifying the solution → Checking the diagram → Adding to the lesson.
- Voice input: the teacher can dictate an instruction; it is transcribed and handled as normal text.

## 4. MathGPL Math Engine — the substance of the change

A dedicated service boundary the UI talks to, with named operations:
`generateLessonSection`, `generateExample`, `generateClasswork`, `generateAssignment`, `analyseQuestion`, `generateSimilarQuestions`, `solveQuestion`, `verifySolution`, `generateGeometry`, `verifyGeometry`, `analyseUploadedMaterial`, `validateMathematics`.

Each returns **structured mathematical output** (question, givens, target, method, diagram model, solution steps, verification report) so content is checkable before it ever reaches the canvas.

Engine rules:
- **Structure before numbers.** "Five quadratics solvable by factorisation" must every one factorise: integer factor pairs and discriminants are checked, not assumed. "Make this harder" increases reasoning demand (method choice, reverse reasoning, multi-step), not digit size.
- **Deterministic verification.** Arithmetic, algebraic rearrangement, factorisation, roots, statistics and coordinate work are re-computed by code, not trusted from prose. The final answer is substituted back into the original equation.
- **Curriculum awareness.** KS3 / GCSE-O-level / IGCSE / A-level: vocabulary, notation, number complexity and reasoning demand adapt to the selected level.
- **Grounding.** Requests are grounded in the project's existing knowledge standards (pedagogical reference, benchmark library, rendering and solution standards) plus recognised curriculum specifications, and the engine reasons and re-derives rather than copying. No invented "world bank".

## 5. Geometry: model first, picture last

```text
question → mathematical model → computed coordinates → verified construction → diagram → check against question → display
```

- Diagrams are constructed from calculated coordinates into the existing 2D geometry scene format — never an image generator, never a picture the maths is fitted to afterwards.
- Verified before display: every vertex on the circle where required, angle markers on the correct vertices, arcs on the correct arcs, extended sides actually extended, labels matching the text, parallel/perpendicular marks correct.
- **Geometry 3D is not driven by the AI.** The Engine describes the required solid, dimensions and labels and asks the teacher to build it with the 3D tool.
- One question = one authoritative diagram stays as it is today.

## 6. Hard gates before anything reaches the canvas

- No solution without a complete, solvable question: question exists → complete → model exists → solvable → solved → verified → shown.
- Question/diagram disagreement, an angle or point that is not in the figure, or an incomplete question causes a silent regeneration, not a display.
- On repeated failure the Engine says plainly what is ambiguous and asks — it never fabricates.

## 7. Conversation quality

- Varied, natural teacher language; no "Great!", "Absolutely!", "Let's dive in!", no developer phrasing ("I'll update the component").
- Greeting knows the teacher's name, topic and subtopic, and varies each session.
- Teacher = supervisor, AI = worker: given "create a lesson on cyclic quadrilaterals" it proposes a full structure and proceeds, asking only on genuine ambiguity.
- Session memory: it recognises correction ("Example 2 is too easy") and responds structurally.

## 8. Lesson-note building workflow (preserved)

The existing procedure stays: structure first, with dynamic numbering.

```text
1 Introduction  2 Explanation  3-5 Examples  6-8 Classwork
9-10 Exercise   11-12 Assignment   13 Conclusion
```

- The teacher sets quantities per section type and can change them.
- Subtopics: adding one anywhere creates its own full structure beneath it; subtopics can be added, removed, reordered and edited.
- Additional-information step (typed notes, textbook photos, test papers, style, level, difficulty, misconceptions) feeds the Engine before generation.
- Build routes stay: complete lesson · step-by-step directed build · examples-and-classwork · explain the existing lesson note.
- All generated content lands in the lesson canvas, progressively — never dumped into chat.
- Highlighted content is the edit target: only that section changes.

## Technical notes

- New `src/lib/mathengine/` service layer: typed request/response contracts and a single client the UI calls. Section tools, solution generation and diagram generation are re-pointed at it; no UI component keeps a direct line to the old generic AI path.
- Backend: the existing `notebook-ai` function gains a separate Math Engine prompt family and knowledge assembly, distinct from the Co-Pilot family, plus structured JSON output modes. Existing modes (`floating`, `verify`, `scan`, `edit`) are untouched.
- Verification: extend the current staged validator with mathematical checks (substitution, factorability, discriminant, unit/sign, geometry consistency) run in code before display; failures trigger bounded regeneration.
- Geometry: reuse the existing scene model, `liberateLabels`, relevance-based label hiding, and the owner-question diagram lock. New work is the construction/verification stage, not a new renderer.
- Co-Pilot: `conversation.ts` loses PLAN/CREATE and gains a single conversational flow with approval gates; `CoPilotPanel.tsx` is restyled light and gains the mode header and voice input.
- No schema changes.

## Sequence

1. Engine service boundary + structured output + deterministic verification.
2. Mode switch, panel restyle, PLAN/CREATE removal, voice input.
3. Geometry model-first construction and verification.
4. Question-generation intelligence (method applicability, structural difficulty, textbook analysis).
5. Conversation quality and approval workflow polish.

## Verification

On a real note: generate five factorisable quadratics and confirm each factorises; ask for a cyclic-quadrilateral question and confirm the diagram's angles, arcs and labels match the question text and the solution; upload a textbook page and confirm new questions preserve method and difficulty without copying; highlight one example, ask for it to be harder, confirm only that example changes and the demand is structural; switch modes and confirm only one AI is ever active.
